//go:build integration

package store

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"path/filepath"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

func TestSnapshotSurvivesRestartAndHashesWireBytes(t *testing.T) {
	dir := t.TempDir()
	openStore := func() *Store {
		t.Helper()
		s, err := Open(filepath.Join(dir, "state"), filepath.Join(dir, "history"), 64<<20, 8<<20, 7, 90)
		if err != nil {
			t.Fatal(err)
		}
		return s
	}
	ctx, now := context.Background(), time.Now().UTC()
	s := openStore()
	chunks, manifest := snapshot(t, 1, "devices", []model.Record{deviceRecord(t, "test:first", now)}, now)
	// Different whitespace and field encodings are valid. Hash the producer's
	// exact bytes, including the one newline delimiter for each ordered chunk.
	wire, err := json.MarshalIndent(chunks[0], "", " ")
	if err != nil {
		t.Fatal(err)
	}
	sum := sha256.Sum256(append(wire, '\n'))
	manifest.Digest = hex.EncodeToString(sum[:])
	if err = s.StageChunkBytes(ctx, chunks[0], wire, now); err != nil {
		t.Fatal(err)
	}
	if err = s.Close(); err != nil {
		t.Fatal(err)
	}
	s = openStore()
	defer s.Close()
	current, err := s.Query(ctx, "device", Query{Limit: 10})
	if err != nil || len(current) != 0 {
		t.Fatal("staged generation visible after restart", err)
	}
	result, err := s.CommitSnapshot(ctx, manifest, now)
	if err != nil || result.Cursor != manifest.Cursor {
		t.Fatal("durable stage not committed", err)
	}
	replay, err := s.CommitSnapshot(ctx, manifest, now.Add(time.Second))
	if err != nil || !replay.Duplicate || replay.Cursor != result.Cursor {
		t.Fatal("replay lost original ACK", err)
	}
}
