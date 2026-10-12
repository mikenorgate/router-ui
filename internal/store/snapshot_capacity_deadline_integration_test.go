//go:build integration && capacity

package store

import (
	"context"
	"path/filepath"
	"testing"
	"time"
)

// The ingest endpoint gives a transaction eight seconds. Keep the capacity
// fixture opt-in so timing is measured on the declared native runner, not CI.
func TestCompletePolicyCapacityDeadline(t *testing.T) {
	now := time.Now().UTC()
	chunks, manifest := capacitySnapshot(t, now)
	directory := t.TempDir()
	s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 64<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	stageCapacity(t, s, chunks, now)
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	start := time.Now()
	result, err := s.CommitSnapshot(ctx, manifest, now)
	if err != nil {
		t.Fatalf("commit after %s: %T: %v (context: %v)", time.Since(start), err, err, ctx.Err())
	}
	if result.Accepted != manifest.Records {
		t.Fatalf("accepted=%d want=%d", result.Accepted, manifest.Records)
	}
	t.Logf("committed %d records in %s", result.Accepted, time.Since(start))
}
