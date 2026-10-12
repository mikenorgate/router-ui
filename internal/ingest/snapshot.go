package ingest

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
	"io"
	"net/http"
	"time"
)

func (s *Server) snapshotRequest(w http.ResponseWriter, r *http.Request, v any, source func() string, run func(context.Context, []byte) (any, error)) {
	uid, ok := r.Context().Value(uidKey{}).(uint32)
	if !ok {
		http.Error(w, "peer identity required", http.StatusForbidden)
		return
	}
	select {
	case s.slots <- struct{}{}:
		defer func() { <-s.slots }()
	default:
		http.Error(w, "ingest busy", http.StatusServiceUnavailable)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, model.MaxChunkBytes)
	defer r.Body.Close()
	body, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "body too large", http.StatusRequestEntityTooLarge)
		return
	}
	d := json.NewDecoder(bytes.NewReader(body))
	d.DisallowUnknownFields()
	if err = d.Decode(v); err != nil {
		http.Error(w, "invalid snapshot request", http.StatusBadRequest)
		return
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		http.Error(w, "one JSON object required", http.StatusBadRequest)
		return
	}
	var kinds []string
	for _, p := range s.Producers {
		if p.UID == uid && p.ID == source() {
			kinds = p.Kinds
		}
	}
	if len(kinds) == 0 {
		http.Error(w, "producer not authorized", http.StatusForbidden)
		return
	}
	now := time.Now()
	switch value := v.(type) {
	case *model.SnapshotChunk:
		err = value.Validate(now, kinds)
	case *model.SnapshotCommit:
		err = value.Validate(now)
		for _, k := range model.ScopeKinds(value.Scope) {
			found := false
			for _, a := range kinds {
				if a == k {
					found = true
				}
			}
			if !found {
				err = errors.New("scope not authorized")
			}
		}
	case *model.SourceStatus:
		err = value.Validate()
		for _, k := range model.ScopeKinds(value.Scope) {
			found := false
			for _, a := range kinds {
				if a == k {
					found = true
				}
			}
			if !found {
				err = errors.New("scope not authorized")
			}
		}
	}
	if err != nil {
		s.Rejected.Add(1)
		http.Error(w, "invalid or unauthorized snapshot", http.StatusBadRequest)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 8*time.Second)
	defer cancel()
	result, err := run(ctx, body)
	if err != nil {
		s.Rejected.Add(1)
		code := 503
		if errors.Is(err, store.ErrSequence) || errors.Is(err, store.ErrSnapshot) {
			code = 409
		}
		if errors.Is(err, store.ErrCapacity) {
			code = 413
		}
		http.Error(w, "not committed; retain acknowledged cursor", code)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(result)
}
func (s *Server) snapshotChunk(w http.ResponseWriter, r *http.Request) {
	var c model.SnapshotChunk
	s.snapshotRequest(w, r, &c, func() string { return c.SourceID }, func(ctx context.Context, body []byte) (any, error) {
		err := s.Store.StageChunkBytes(ctx, c, body, time.Now())
		return map[string]bool{"staged": err == nil}, err
	})
}
func (s *Server) snapshotCommit(w http.ResponseWriter, r *http.Request) {
	var c model.SnapshotCommit
	s.snapshotRequest(w, r, &c, func() string { return c.SourceID }, func(ctx context.Context, _ []byte) (any, error) {
		result, err := s.Store.CommitSnapshot(ctx, c, time.Now())
		if err == nil && !result.Duplicate {
			s.Accepted.Add(uint64(result.Accepted))
		}
		return result, err
	})
}
func (s *Server) sourceStatus(w http.ResponseWriter, r *http.Request) {
	var status model.SourceStatus
	s.snapshotRequest(w, r, &status, func() string { return status.SourceID }, func(ctx context.Context, _ []byte) (any, error) {
		err := s.Store.ReportSourceStatus(ctx, status, time.Now())
		return map[string]bool{"reported": err == nil}, err
	})
}
