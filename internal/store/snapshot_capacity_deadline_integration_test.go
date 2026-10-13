//go:build integration && capacity && linux

package store

import (
	"context"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

// The ingest endpoint gives a transaction eight seconds. Keep the capacity
// fixture opt-in so timing is measured on the declared native runner, not CI.
func TestCompletePolicyCapacityDeadline(t *testing.T) {
	validateCapacityLimits(t)
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
	before := usage(t)
	throttledBefore := throttledTime(t)
	result, err := s.CommitSnapshot(ctx, manifest, now)
	logCommitUsage(t, "initial", start, before, throttledBefore)
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
		before = usage(t)
		throttledBefore = throttledTime(t)
		result, err = s.CommitSnapshot(ctx, manifest, manifest.ObservedAt)
		logCommitUsage(t, operation, start, before, throttledBefore)
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

func usage(t *testing.T) syscall.Rusage {
	t.Helper()
	var result syscall.Rusage
	if err := syscall.Getrusage(syscall.RUSAGE_SELF, &result); err != nil {
		t.Fatal(err)
	}
	return result
}

func logCommitUsage(t *testing.T, operation string, start time.Time, before syscall.Rusage, throttledBefore time.Duration) {
	t.Helper()
	after := usage(t)
	micros := func(value syscall.Timeval) time.Duration {
		return time.Duration(value.Sec)*time.Second + time.Duration(value.Usec)*time.Microsecond
	}
	cpu := micros(after.Utime) + micros(after.Stime) - micros(before.Utime) - micros(before.Stime)
	t.Logf("%s: wall=%s process_cpu=%s cgroup_throttled=%s input_blocks=%d output_blocks=%d", operation, time.Since(start), cpu, throttledTime(t)-throttledBefore, after.Inblock-before.Inblock, after.Oublock-before.Oublock)
}

func capacityFile(t *testing.T, name string) string {
	t.Helper()
	body, err := os.ReadFile("/sys/fs/cgroup/" + name)
	if err != nil {
		t.Fatalf("capacity runner must expose its cgroup v2 limits: %v", err)
	}
	return strings.TrimSpace(string(body))
}

func validateCapacityLimits(t *testing.T) {
	t.Helper()
	cpu, memory, swap := capacityFile(t, "cpu.max"), capacityFile(t, "memory.max"), capacityFile(t, "memory.swap.max")
	fields := strings.Fields(cpu)
	if len(fields) != 2 {
		t.Fatalf("invalid CPU limit: %q", cpu)
	}
	quota, err := strconv.ParseUint(fields[0], 10, 64)
	if err != nil {
		t.Fatalf("a hard CPU quota is required: %q", cpu)
	}
	period, err := strconv.ParseUint(fields[1], 10, 64)
	if err != nil || period == 0 || quota == 0 || quota > period {
		t.Fatalf("runner exceeds one CPU: %q", cpu)
	}
	limit, err := strconv.ParseUint(memory, 10, 64)
	if err != nil || limit == 0 || limit > 2<<30 || swap != "0" {
		t.Fatalf("runner exceeds memory/swap ceiling: memory=%q swap=%q", memory, swap)
	}
	t.Logf("enforced limits: cpu.max=%s memory.max=%s memory.swap.max=%s", cpu, memory, swap)
}

func throttledTime(t *testing.T) time.Duration {
	t.Helper()
	for _, row := range strings.Split(capacityFile(t, "cpu.stat"), "\n") {
		fields := strings.Fields(row)
		if len(fields) == 2 && fields[0] == "throttled_usec" {
			value, err := strconv.ParseUint(fields[1], 10, 64)
			if err != nil {
				t.Fatal(err)
			}
			return time.Duration(value) * time.Microsecond
		}
	}
	t.Fatal("CPU throttling measurement unavailable")
	return 0
}

// Cancellation is triggered after the writer spills new WAL pages, proving
// rollback after transaction work rather than only rejecting an expired context.
func TestCompletePolicyCapacityCancellationKeepsAcknowledgement(t *testing.T) {
	validateCapacityLimits(t)
	now := time.Now().UTC()
	chunks, manifest := capacitySnapshot(t, now)
	directory := t.TempDir()
	s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 64<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	initial := []model.SnapshotChunk{{SnapshotIdentity: manifest.SnapshotIdentity, Records: chunks[0].Records[:2]}}
	seed := manifest
	seed.Chunks, seed.Records = 1, 2
	seed.Digest, err = model.SnapshotDigest(initial)
	if err != nil {
		t.Fatal(err)
	}
	stageCapacity(t, s, initial, now)
	if _, err = s.CommitSnapshot(t.Context(), seed, now); err != nil {
		t.Fatal(err)
	}
	chunks, manifest = nextCapacitySnapshot(t, chunks, manifest, "shared-rule-revision")
	stageCapacity(t, s, chunks, manifest.ObservedAt)
	wal := s.path + "-wal"
	information, err := os.Stat(wal)
	if err != nil {
		t.Fatal(err)
	}
	previousSize := information.Size()
	ctx, cancel := context.WithTimeout(t.Context(), 5*time.Second)
	defer cancel()
	stop := make(chan struct{})
	observedWrite := make(chan bool, 1)
	go func() {
		ticker := time.NewTicker(time.Millisecond)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				observedWrite <- false
				return
			case <-ctx.Done():
				observedWrite <- false
				return
			case <-ticker.C:
				information, err := os.Stat(wal)
				if err == nil && information.Size() > previousSize+(1<<20) {
					cancel()
					observedWrite <- true
					return
				}
			}
		}
	}()
	_, err = s.CommitSnapshot(ctx, manifest, manifest.ObservedAt)
	close(stop)
	if !<-observedWrite || err == nil {
		t.Fatalf("failed to cancel after WAL spill: %v", err)
	}
	for _, kind := range []string{"rule", "application"} {
		rows, queryErr := s.Query(t.Context(), kind, Query{Limit: 500})
		if queryErr != nil || len(rows) != 1 {
			t.Fatalf("partial %s generation: %d, %v", kind, len(rows), queryErr)
		}
	}
	sources, err := s.Sources(t.Context(), now)
	if err != nil || len(sources) != 1 || sources[0].LastSequence != 1 {
		t.Fatalf("uncommitted acknowledgement advanced: %v, %v", sources, err)
	}
	var cursor string
	if err = s.read.QueryRowContext(t.Context(), "SELECT cursor FROM sources WHERE id='test'").Scan(&cursor); err != nil || cursor != "1" {
		t.Fatalf("uncommitted cursor advanced: %q, %v", cursor, err)
	}
	// Retry the same durable generation; this is a rollback/replay check. The
	// separate deadline test owns wall-clock performance acceptance.
	retry, stopRetry := context.WithTimeout(t.Context(), 30*time.Second)
	defer stopRetry()
	result, err := s.CommitSnapshot(retry, manifest, manifest.ObservedAt)
	if err != nil || result.Accepted != manifest.Records || result.Cursor != manifest.Cursor {
		t.Fatalf("replay after cancellation: %+v, %v", result, err)
	}
}
