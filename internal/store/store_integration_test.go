//go:build integration

package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

func testStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	s, err := Open(filepath.Join(dir, "state"), filepath.Join(dir, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return s
}
func flowBatch(t *testing.T, sequence uint64, ids ...string) model.Batch {
	t.Helper()
	now := time.Now().UTC()
	b := model.Batch{Version: 1, SourceID: "test", BootID: "boot-1", Sequence: sequence, Cursor: fmt.Sprint(sequence), SamplingRate: 1}
	for _, id := range ids {
		f := model.Flow{ID: id, SourceIP: "192.0.2.10", DestinationIP: "203.0.113.5", DeviceID: "device-1", StartedAt: now.Add(-time.Minute), LastSeen: now, BytesSent: 100, BytesReceived: 200, Verdict: "unknown", SamplingRate: 1}
		data, err := json.Marshal(f)
		if err != nil {
			t.Fatal(err)
		}
		b.Records = append(b.Records, model.Record{ID: id, Kind: "flow", ObservedAt: now, Data: data})
	}
	return b
}
func TestReplayAndAtomicCursor(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	b := flowBatch(t, 1, "flow-1")
	if _, err := s.Ingest(ctx, b, time.Now()); err != nil {
		t.Fatal(err)
	}
	replay, err := s.Ingest(ctx, b, time.Now())
	if err != nil || !replay.Duplicate || replay.Cursor != "1" {
		t.Fatalf("replay=%+v error=%v", replay, err)
	}
	conflict := b
	conflict.Cursor = "changed-content"
	if _, err = s.Ingest(ctx, conflict, time.Now()); !errors.Is(err, ErrSequence) {
		t.Fatal("conflicting duplicate sequence accepted")
	}
	bad := flowBatch(t, 2, "flow-2")
	bad.Records = append(bad.Records, model.Record{ID: "bad", Kind: "flow", ObservedAt: time.Now(), Data: json.RawMessage(`{"bytes_sent":"bad"}`)})
	if _, err = s.Ingest(ctx, bad, time.Now()); err == nil {
		t.Fatal("invalid flow committed")
	}
	items, err := s.Query(ctx, "flow", Query{})
	if err != nil || len(items) != 1 {
		t.Fatalf("atomic rollback items=%d err=%v", len(items), err)
	}
	sources, err := s.Sources(ctx, time.Now())
	if err != nil || sources[0].LastSequence != 1 {
		t.Fatalf("cursor advanced after rollback: %+v %v", sources, err)
	}
	old := flowBatch(t, 1, "flow-old")
	old.BootID = "boot-2"
	if _, err = s.Ingest(ctx, old, time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Ingest(ctx, b, time.Now()); !errors.Is(err, ErrSequence) {
		t.Fatalf("boot replay accepted: %v", err)
	}
}
func TestSamplingPreservesSummariesAndDeduplicates(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	if _, err := s.history.Exec("UPDATE settings SET value=0.125 WHERE key='sampling_rate'"); err != nil {
		t.Fatal(err)
	}
	ids := []string{}
	for i := 0; i < 200; i++ {
		ids = append(ids, fmt.Sprintf("f-%03d", i))
	}
	b := flowBatch(t, 1, ids...)
	result, err := s.Ingest(ctx, b, time.Now())
	if err != nil {
		t.Fatal(err)
	}
	if result.Accepted == 0 || result.Sampled == 0 {
		t.Fatalf("expected deterministic sample %+v", result)
	}
	b.Sequence = 2
	if _, err = s.Ingest(ctx, b, time.Now()); err != nil {
		t.Fatal(err)
	}
	var count, sent int
	if err = s.history.QueryRow("SELECT SUM(flows),SUM(sent) FROM summaries").Scan(&count, &sent); err != nil {
		t.Fatal(err)
	}
	if count != 200 || sent != 20000 {
		t.Fatalf("summary counted samples/replays: %d %d", count, sent)
	}
	items, err := s.Query(ctx, "flow", Query{Limit: 500})
	if err != nil || len(items) != result.Accepted {
		t.Fatalf("sample retrieval %d err=%v", len(items), err)
	}
	for _, item := range items {
		var f model.Flow
		if err = json.Unmarshal(item, &f); err != nil {
			t.Fatal(err)
		}
		if f.SamplingRate != 0.125 {
			t.Fatal("sample rate not recorded")
		}
	}
}
func TestRetentionKeepsSevenDaySpan(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	b := flowBatch(t, 1)
	for day := 0; day < 12; day++ {
		rs := flowBatch(t, 1, fmt.Sprintf("flow-%d", day)).Records[0]
		rs.ObservedAt = now.AddDate(0, 0, -day)
		b.Records = append(b.Records, rs)
	}
	if _, err := s.Ingest(ctx, b, now); err != nil {
		t.Fatal(err)
	}
	if err := s.Maintenance(ctx, now); err != nil {
		t.Fatal(err)
	}
	items, err := s.Query(ctx, "flow", Query{Limit: 500})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for _, item := range items {
		var f model.Flow
		if err = json.Unmarshal(item, &f); err != nil {
			t.Fatal(err)
		}
		seen[f.ID] = true
	}
	for i := 0; i < 7; i++ {
		if !seen[fmt.Sprintf("flow-%d", i)] {
			t.Fatalf("recent day %d prematurely discarded", i)
		}
	}
}
