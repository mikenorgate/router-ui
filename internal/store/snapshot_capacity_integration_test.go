//go:build integration

package store

import (
	"context"
	"encoding/json"
	"fmt"
	"path/filepath"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

// capacitySnapshot exercises eight inherited rules for the full device limit.
// It stays within the public 32 MiB/65,536-record snapshot bounds.
func capacitySnapshot(t testing.TB, now time.Time) ([]model.SnapshotChunk, model.SnapshotCommit) {
	t.Helper()
	installed := true
	records := make([]model.Record, 0, 8*4097)
	add := func(kind, id string, value any) {
		body, err := json.Marshal(value)
		if err != nil {
			t.Fatal(err)
		}
		records = append(records, model.Record{Kind: kind, ID: id, ObservedAt: now, Data: body})
	}
	for rule := range 8 {
		id := fmt.Sprintf("test:rule-%d", rule)
		add("rule", id, model.Policy{ID: id, Name: "Inherited fixture rule", Action: "allow", Scope: "baseline", Conditions: "Interface-qualified destination port; shared installed counters", Installed: &installed, Origin: model.Origin{Producer: "fixture", PolicyID: id, Revision: "fixture-revision", SourceRef: "policy/baseline.nft"}, Table: "inet fixture", Chain: "forward", Hook: "forward", Order: rule, ObservedAt: now, CountersScope: "shared"})
		for device := range 4096 {
			applicationID := fmt.Sprintf("test:application-%d-%064x", rule, device)
			add("application", applicationID, model.Application{ID: applicationID, RuleID: id, DeviceID: fmt.Sprintf("devices:%064x", device), BindingRef: fmt.Sprintf("binding-%064x", device), InstallationGeneration: "fixture-generation", Installed: &installed, Applicable: &installed, CountersScope: "shared", Lifecycle: "active", LifecycleAt: now, ObservedAt: now})
		}
	}
	identity := model.SnapshotIdentity{Version: 2, SourceID: "test", BootID: "capacity-boot", Sequence: 1, Scope: "policies", Generation: "capacity-generation", ObservedAt: now}
	var chunks []model.SnapshotChunk
	totalBytes := 0
	for start := 0; start < len(records); start += 128 {
		chunk := model.SnapshotChunk{SnapshotIdentity: identity, Index: len(chunks), Records: records[start:min(start+128, len(records))]}
		body, err := json.Marshal(chunk)
		if err != nil {
			t.Fatal(err)
		}
		totalBytes += len(body)
		chunks = append(chunks, chunk)
	}
	if totalBytes > model.MaxSnapshotBytes || len(records) > model.MaxSnapshotRecords {
		t.Fatalf("fixture exceeds contract: %d bytes, %d records", totalBytes, len(records))
	}
	digest, err := model.SnapshotDigest(chunks)
	if err != nil {
		t.Fatal(err)
	}
	return chunks, model.SnapshotCommit{SnapshotIdentity: identity, Chunks: len(chunks), Records: len(records), Digest: digest, Cursor: "1", Complete: true}
}

func stageCapacity(t testing.TB, s *Store, chunks []model.SnapshotChunk, now time.Time) {
	t.Helper()
	for _, chunk := range chunks {
		if err := s.StageChunk(context.Background(), chunk, now); err != nil {
			t.Fatal(err)
		}
	}
}

func BenchmarkCompletePolicyCapacity(b *testing.B) {
	now := time.Now().UTC()
	chunks, manifest := capacitySnapshot(b, now)
	b.ReportAllocs()
	for range b.N {
		b.StopTimer()
		directory := b.TempDir()
		s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 64<<20, 7, 90)
		if err != nil {
			b.Fatal(err)
		}
		stageCapacity(b, s, chunks, now)
		b.StartTimer()
		result, err := s.CommitSnapshot(context.Background(), manifest, now)
		b.StopTimer()
		closeErr := s.Close()
		if err != nil || result.Accepted != manifest.Records || closeErr != nil {
			b.Fatalf("commit: accepted=%d error=%v close=%v", result.Accepted, err, closeErr)
		}
	}
}
