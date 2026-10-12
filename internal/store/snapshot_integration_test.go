//go:build integration

package store

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"github.com/mikenorgate/router-ui/internal/model"
	"path/filepath"
	"testing"
	"time"
)

func snapshotStore(t *testing.T) *Store {
	t.Helper()
	dir := t.TempDir()
	s, e := Open(filepath.Join(dir, "state"), filepath.Join(dir, "history"), 64<<20, 8<<20, 7, 90)
	if e != nil {
		t.Fatal(e)
	}
	t.Cleanup(func() { _ = s.Close() })
	return s
}
func snapshot(t *testing.T, seq uint64, scope string, records []model.Record, now time.Time) ([]model.SnapshotChunk, model.SnapshotCommit) {
	t.Helper()
	identity := model.SnapshotIdentity{Version: 2, SourceID: "test", BootID: "boot", Sequence: seq, Scope: scope, Generation: fmt.Sprintf("g%d", seq), ObservedAt: now}
	chunks := []model.SnapshotChunk{}
	for len(records) > 0 {
		n := min(len(records), 128)
		chunks = append(chunks, model.SnapshotChunk{SnapshotIdentity: identity, Index: len(chunks), Records: records[:n]})
		records = records[n:]
	}
	if len(chunks) == 0 {
		chunks = append(chunks, model.SnapshotChunk{SnapshotIdentity: identity, Records: []model.Record{}})
	}
	digest, e := model.SnapshotDigest(chunks)
	if e != nil {
		t.Fatal(e)
	}
	count := 0
	for _, c := range chunks {
		count += len(c.Records)
	}
	return chunks, model.SnapshotCommit{SnapshotIdentity: identity, Chunks: len(chunks), Records: count, Digest: digest, Cursor: fmt.Sprint(seq), Complete: true}
}
func deviceRecord(t *testing.T, id string, now time.Time) model.Record {
	t.Helper()
	body, e := json.Marshal(model.Device{ID: id, Name: "Test", ObservedAt: now, LastSeen: now, Status: "observed", Addresses: []model.Address{}})
	if e != nil {
		t.Fatal(e)
	}
	return model.Record{Kind: "device", ID: id, ObservedAt: now, Data: body}
}
func commit(t *testing.T, s *Store, chunks []model.SnapshotChunk, c model.SnapshotCommit, now time.Time) Result {
	t.Helper()
	for _, chunk := range chunks {
		if e := s.StageChunk(context.Background(), chunk, now); e != nil {
			t.Fatal(e)
		}
	}
	out, e := s.CommitSnapshot(context.Background(), c, now)
	if e != nil {
		t.Fatal(e)
	}
	return out
}
func TestSnapshotAtomicReplayAndRemoval(t *testing.T) {
	s := snapshotStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	rs := []model.Record{}
	for i := range 257 {
		rs = append(rs, deviceRecord(t, fmt.Sprintf("test:d%d", i), now))
	}
	chunks, c := snapshot(t, 1, "devices", rs, now)
	if e := s.StageChunk(ctx, chunks[1], now); e != nil {
		t.Fatal(e)
	}
	if _, e := s.CommitSnapshot(ctx, c, now); !errors.Is(e, ErrSnapshot) {
		t.Fatalf("missing chunk: %v", e)
	}
	rows, e := s.Query(ctx, "device", Query{Limit: 500})
	if e != nil || len(rows) != 0 {
		t.Fatalf("partial activation: %d %v", len(rows), e)
	}
	if got := commit(t, s, chunks, c, now); got.Accepted != 257 {
		t.Fatal(got)
	}
	if got := commit(t, s, chunks, c, now); !got.Duplicate {
		t.Fatal("replay not idempotent")
	}
	chunks, c = snapshot(t, 2, "devices", rs[:1], now.Add(time.Second))
	commit(t, s, chunks, c, now.Add(time.Second))
	rows, e = s.Query(ctx, "device", Query{Limit: 500})
	if e != nil || len(rows) != 1 {
		t.Fatalf("scope replacement: %d %v", len(rows), e)
	}
	history, e := s.Query(ctx, "device", Query{History: true, DeviceID: "test:d1", Limit: 100})
	if e != nil || len(history) != 2 {
		t.Fatalf("removal history: %d %v", len(history), e)
	}
}
func TestSnapshotRejectsInvalidCommit(t *testing.T) {
	for _, name := range []string{"digest", "records", "expired", "incomplete", "duplicate-id", "namespace", "overflow"} {
		t.Run(name, func(t *testing.T) {
			s := snapshotStore(t)
			now := time.Now().UTC()
			rs := []model.Record{deviceRecord(t, "test:d", now)}
			if name == "duplicate-id" {
				rs = append(rs, rs[0])
			}
			if name == "namespace" {
				rs[0] = deviceRecord(t, "other:d", now)
			}
			if name == "overflow" {
				rs = nil
				for i := range 4097 {
					rs = append(rs, deviceRecord(t, fmt.Sprintf("test:d%d", i), now))
				}
			}
			chunks, c := snapshot(t, 1, "devices", rs, now)
			switch name {
			case "digest":
				c.Digest = fmt.Sprintf("%064d", 0)
			case "records":
				c.Records++
			case "incomplete":
				c.Complete = false
			}
			for _, chunk := range chunks {
				e := s.StageChunk(context.Background(), chunk, now)
				if name == "namespace" {
					if e == nil {
						t.Fatal("namespace accepted")
					}
					return
				}
				if e != nil {
					t.Fatal(e)
				}
			}
			if name == "expired" {
				now = now.Add(5 * time.Minute)
			}
			if _, e := s.CommitSnapshot(context.Background(), c, now); e == nil {
				t.Fatal("invalid commit accepted")
			}
			sources, e := s.Sources(context.Background(), now)
			if e != nil || len(sources) > 0 {
				t.Fatal("ACK advanced", sources, e)
			}
		})
	}
}
func TestSnapshotHistoryOnlySemanticChangesAndHealthFreshness(t *testing.T) {
	s := snapshotStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	r := deviceRecord(t, "test:d", now)
	chunks, c := snapshot(t, 1, "devices", []model.Record{r}, now)
	commit(t, s, chunks, c, now)
	later := now.Add(2 * time.Minute)
	r = deviceRecord(t, "test:d", later)
	chunks, c = snapshot(t, 2, "devices", []model.Record{r}, later)
	commit(t, s, chunks, c, later)
	history, e := s.Query(ctx, "device", Query{History: true, DeviceID: r.ID, Limit: 100})
	if e != nil || len(history) != 1 {
		t.Fatalf("unchanged catalog history: %d %v", len(history), e)
	}
	if e = s.ReportSourceStatus(ctx, model.SourceStatus{Version: 2, SourceID: "test", Scope: "devices", Status: "current"}, later.Add(2*time.Minute)); e != nil {
		t.Fatal(e)
	}
	sources, e := s.Sources(ctx, later.Add(2*time.Minute))
	if e != nil || sources[0].Status != "stale" || !sources[0].ObservedAt.Equal(later) {
		t.Fatal(sources, e)
	}
}
func TestPolicyPaginationAndRemovalEvidence(t *testing.T) {
	s := snapshotStore(t)
	ctx := context.Background()
	now := time.Now().UTC()
	yes := true
	records := []model.Record{}
	for i := range 600 {
		rule := model.Policy{ID: fmt.Sprintf("test:r%d", i), Name: "Shared rule", CountersScope: "shared", Installed: &yes, ObservedAt: now}
		b, _ := json.Marshal(rule)
		records = append(records, model.Record{ID: rule.ID, Kind: "rule", ObservedAt: now, Data: b})
		a := model.Application{ID: fmt.Sprintf("test:a%d", i), RuleID: rule.ID, DeviceID: fmt.Sprintf("test:d%d", i), BindingRef: "test:b", InstallationGeneration: "g1", Installed: &yes, Applicable: &yes, CountersScope: "shared", Lifecycle: "active", LifecycleAt: now, ObservedAt: now}
		b, _ = json.Marshal(a)
		records = append(records, model.Record{ID: a.ID, Kind: "application", ObservedAt: now, Data: b})
	}
	chunks, c := snapshot(t, 1, "policies", records, now)
	commit(t, s, chunks, c, now)
	policies, e := s.PolicyViews(ctx, Query{DeviceID: "test:d599", Limit: 100})
	if e != nil || len(policies) != 1 || policies[0].RuleID != "test:r599" || policies[0].ObservedMatch != nil {
		t.Fatal(policies, e)
	}
	chunks, c = snapshot(t, 2, "policies", nil, now.Add(time.Second))
	commit(t, s, chunks, c, now.Add(time.Second))
	history, e := s.Query(ctx, "policy", Query{History: true, RecordID: "test:a599", Limit: 100})
	if e != nil || len(history) != 2 {
		t.Fatal(len(history), e)
	}
	var p model.Policy
	if e = json.Unmarshal(history[0], &p); e != nil || p.Lifecycle != "confirmed_removed" || p.Installed == nil || *p.Installed {
		t.Fatal(p, e)
	}
}
