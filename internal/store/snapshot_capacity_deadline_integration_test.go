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
	if elapsed := time.Since(start); elapsed > 8*time.Second {
		t.Fatalf("initial commit exceeded budget: %s", elapsed)
	}
	t.Logf("committed %d records in %s", result.Accepted, time.Since(start))
	cancel()
	for _, operation := range []string{"shared-rule-revision", "complete-removal"} {
		chunks, manifest = nextCapacitySnapshot(t, chunks, manifest, operation)
		stageCapacity(t, s, chunks, manifest.ObservedAt)
		ctx, cancel = context.WithTimeout(t.Context(), 8*time.Second)
		start = time.Now()
		result, err = s.CommitSnapshot(ctx, manifest, manifest.ObservedAt)
		cancel()
		if err != nil || result.Accepted != manifest.Records {
			t.Fatalf("%s after %s: accepted=%d, %v", operation, time.Since(start), result.Accepted, err)
		}
		if elapsed := time.Since(start); elapsed > 8*time.Second {
			t.Fatalf("%s exceeded budget: %s", operation, elapsed)
		}
		t.Logf("%s in %s", operation, time.Since(start))
	}
}
