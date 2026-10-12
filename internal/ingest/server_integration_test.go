//go:build integration && linux

package ingest

import (
	"context"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/store"
)

func TestRealUnixPeerAuthorization(t *testing.T) {
	d := t.TempDir()
	s, err := store.Open(filepath.Join(d, "state"), filepath.Join(d, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	socket := filepath.Join(d, "ingest.sock")
	l, err := Listen(socket)
	if err != nil {
		t.Fatal(err)
	}
	server := New(s, []config.Producer{{ID: "authorized", UID: uint32(os.Getuid()), Kinds: []string{"event", "device"}}, {ID: "other-uid", UID: uint32(os.Getuid() + 1), Kinds: []string{"event", "device"}}})
	httpd := &http.Server{Handler: server.Handler(), ConnContext: PeerContext, ReadHeaderTimeout: time.Second}
	go httpd.Serve(l)
	defer httpd.Close()
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", socket)
	}}
	defer transport.CloseIdleConnections()
	client := http.Client{Transport: transport, Timeout: 2 * time.Second}
	for _, tc := range []struct {
		name, source string
		status       int
	}{{"authorized peer", "authorized", 200}, {"forged producer with different UID", "other-uid", 403}, {"unregistered source", "unknown", 403}} {
		t.Run(tc.name, func(t *testing.T) {
			body := `{"version":1,"source_id":"` + tc.source + `","boot_id":"boot-1","sequence":1,"cursor":"journal-cursor","coverage":"test","sampling_rate":1,"lost_records":0,"records":[]}`
			req, err := http.NewRequest("POST", "http://unix/ingest/v1/batches", strings.NewReader(body))
			if err != nil {
				t.Fatal(err)
			}
			req.Header.Set("X-Producer-UID", "0")
			res, err := client.Do(req)
			if err != nil {
				t.Fatal(err)
			}
			res.Body.Close()
			if res.StatusCode != tc.status {
				t.Fatalf("status %d expected %d", res.StatusCode, tc.status)
			}
		})
	}
	for _, tc := range []struct {
		source string
		status int
	}{
		{"authorized", 200}, {"other-uid", 403}, {"unknown", 403},
	} {
		body := `{"version":2,"source_id":"` + tc.source + `","boot_id":"boot-1","sequence":2,"scope":"devices","generation":"g2","observed_at":"` + time.Now().UTC().Format(time.RFC3339Nano) + `","index":0,"records":[]}`
		req, err := http.NewRequest("POST", "http://unix/ingest/v2/snapshots/chunks", strings.NewReader(body))
		if err != nil {
			t.Fatal(err)
		}
		req.Header.Set("X-Producer-UID", "0")
		res, err := client.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		res.Body.Close()
		if res.StatusCode != tc.status {
			t.Fatalf("v2 peer %s: %d", tc.source, res.StatusCode)
		}
	}

}
