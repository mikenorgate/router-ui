//go:build linux

// Package ingest authenticates local producers with Linux SO_PEERCRED, never request headers.
package ingest

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"sync/atomic"
	"syscall"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
)

type uidKey struct{}
type Server struct {
	Health    func() map[string]float64
	Store     *store.Store
	Producers []config.Producer
	Accepted  atomic.Uint64
	Rejected  atomic.Uint64
	Sampled   atomic.Uint64
	slots     chan struct{}
}

func New(s *store.Store, producers []config.Producer) *Server {
	return &Server{Store: s, Producers: producers, slots: make(chan struct{}, 2)}
}
func PeerContext(ctx context.Context, c net.Conn) context.Context {
	u, ok := c.(*net.UnixConn)
	if !ok {
		return ctx
	}
	raw, err := u.SyscallConn()
	if err != nil {
		return ctx
	}
	var cred *syscall.Ucred
	var inner error
	err = raw.Control(func(fd uintptr) {
		cred, inner = syscall.GetsockoptUcred(int(fd), syscall.SOL_SOCKET, syscall.SO_PEERCRED)
	})
	if err != nil || inner != nil || cred == nil {
		return ctx
	}
	return context.WithValue(ctx, uidKey{}, cred.Uid)
}
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /ingest/v1/batches", s.batch)
	mux.HandleFunc("GET /metrics", s.metrics)
	mux.HandleFunc("POST /ingest/v2/snapshots/chunks", s.snapshotChunk)
	mux.HandleFunc("POST /ingest/v2/snapshots/commit", s.snapshotCommit)
	mux.HandleFunc("POST /ingest/v2/source-status", s.sourceStatus)
	return mux
}
func (s *Server) batch(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(uidKey{}).(uint32)
	if !ok {
		http.Error(w, "peer identity unavailable", http.StatusForbidden)
		return
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		http.Error(w, "ingest busy; retry the same batch", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<20)
	defer r.Body.Close()
	var b model.Batch
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(&b); err != nil {
		s.Rejected.Add(1)
		http.Error(w, "invalid batch", http.StatusBadRequest)
		return
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		http.Error(w, "one batch required", http.StatusBadRequest)
		return
	}
	var kinds []string
	for _, p := range s.Producers {
		if p.UID == uid && p.ID == b.SourceID {
			kinds = p.Kinds
		}
	}
	if len(kinds) == 0 {
		s.Rejected.Add(1)
		http.Error(w, "producer not authorized", http.StatusForbidden)
		return
	}
	if err := b.Validate(time.Now(), kinds); err != nil {
		s.Rejected.Add(1)
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	result, err := s.Store.Ingest(ctx, b, time.Now())
	if err != nil {
		s.Rejected.Add(1)
		status := 503
		if errors.Is(err, store.ErrSequence) {
			status = 409
		}
		http.Error(w, "batch not committed; replay from acknowledged cursor", status)
		return
	}
	s.Accepted.Add(uint64(result.Accepted))
	s.Sampled.Add(uint64(result.Sampled))
	w.Header().Set("Content-Type", "application/json")
	if err = json.NewEncoder(w).Encode(result); err != nil {
		return
	}
}
func (s *Server) metrics(w http.ResponseWriter, r *http.Request) {
	uid, ok := r.Context().Value(uidKey{}).(uint32)
	authorized := ok && uid == uint32(os.Getuid())
	for _, p := range s.Producers {
		if ok && p.UID == uid {
			authorized = true
		}
	}
	if !authorized {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()
	stats, err := s.Store.Stats(ctx)
	if err != nil {
		http.Error(w, "storage unavailable", http.StatusServiceUnavailable)
		return
	}
	w.Header().Set("Content-Type", "text/plain; version=0.0.4")
	fmt.Fprintf(w, "router_console_ingest_accepted_total %d\nrouter_console_ingest_rejected_total %d\nrouter_console_ingest_sampled_total %d\nrouter_console_history_bytes %d\nrouter_console_history_budget_bytes %d\nrouter_console_storage_sample_rate %g\n", s.Accepted.Load(), s.Rejected.Load(), s.Sampled.Load(), stats.Used, stats.Budget, stats.SamplingRate)
	sources, err := s.Store.Sources(ctx, time.Now())
	if err != nil {
		return
	}
	if s.Health != nil {
		for name, value := range s.Health() {
			fmt.Fprintf(w, "router_console_%s %g\n", name, value)
		}
	}
	for _, source := range sources {
		fmt.Fprintf(w, "router_console_source_sequence_gaps{source=%q} %d\n", source.ID, source.SequenceGaps)
		fmt.Fprintf(w, "router_console_source_lag_seconds{source=%q} %g\nrouter_console_source_lost_records{source=%q} %d\n", source.ID, source.LagSeconds, source.ID, source.LostRecords)
	}
}
func Listen(path string) (net.Listener, error) {
	if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
		return nil, err
	}
	if _, err := os.Lstat(path); err == nil {
		return nil, errors.New("ingest socket already exists; refuse to unlink another service endpoint")
	} else if !errors.Is(err, os.ErrNotExist) {
		return nil, err
	}
	l, err := net.Listen("unix", path)
	if err != nil {
		return nil, err
	}
	if err = os.Chmod(path, 0660); err != nil {
		l.Close()
		return nil, err
	}
	return l, nil
}
