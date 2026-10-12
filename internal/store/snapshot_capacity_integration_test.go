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
	b.StopTimer()
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

func nextCapacitySnapshot(t testing.TB, chunks []model.SnapshotChunk, manifest model.SnapshotCommit, operation string) ([]model.SnapshotChunk, model.SnapshotCommit) {
	t.Helper()
	manifest.Sequence++
	manifest.Generation, manifest.Cursor = operation, operation
	manifest.ObservedAt = manifest.ObservedAt.Add(time.Second)
	for index := range chunks {
		chunks[index].SnapshotIdentity = manifest.SnapshotIdentity
		for recordIndex := range chunks[index].Records {
			record := &chunks[index].Records[recordIndex]
			record.ObservedAt = manifest.ObservedAt
			var data map[string]any
			if err := json.Unmarshal(record.Data, &data); err != nil {
				t.Fatal(err)
			}
			data["observed_at"] = manifest.ObservedAt
			if record.Kind == "rule" && operation == "shared-rule-revision" {
				data["origin"].(map[string]any)["revision"] = "updated-fixture-revision"
			}
			var err error
			record.Data, err = json.Marshal(data)
			if err != nil {
				t.Fatal(err)
			}
		}
	}
	if operation == "complete-removal" {
		chunks = []model.SnapshotChunk{{SnapshotIdentity: manifest.SnapshotIdentity, Records: []model.Record{}}}
		manifest.Records = 0
	}
	manifest.Chunks = len(chunks)
	var err error
	manifest.Digest, err = model.SnapshotDigest(chunks)
	if err != nil {
		t.Fatal(err)
	}
	return chunks, manifest
}

func BenchmarkPolicyLifecycleCapacity(b *testing.B) {
	for _, operation := range []string{"unchanged", "shared-rule-revision", "complete-removal"} {
		b.Run(operation, func(b *testing.B) {
			b.ReportAllocs()
			for range b.N {
				b.StopTimer()
				now := time.Now().UTC()
				chunks, manifest := capacitySnapshot(b, now)
				directory := b.TempDir()
				s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 64<<20, 7, 90)
				if err != nil {
					b.Fatal(err)
				}
				stageCapacity(b, s, chunks, now)
				if _, err = s.CommitSnapshot(b.Context(), manifest, now); err != nil {
					s.Close()
					b.Fatal(err)
				}
				chunks, manifest = nextCapacitySnapshot(b, chunks, manifest, operation)
				stageCapacity(b, s, chunks, manifest.ObservedAt)
				b.StartTimer()
				result, err := s.CommitSnapshot(b.Context(), manifest, manifest.ObservedAt)
				b.StopTimer()
				closeErr := s.Close()
				if err != nil || closeErr != nil || result.Accepted != manifest.Records {
					b.Fatalf("%s: accepted=%d, error=%v, close=%v", operation, result.Accepted, err, closeErr)
				}
			}
		})
	}
}

func capacityQueryStore(b *testing.B) *Store {
	b.Helper()
	b.StopTimer()
	now := time.Now().UTC()
	chunks, manifest := capacitySnapshot(b, now)
	directory := b.TempDir()
	s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 64<<20, 7, 90)
	if err != nil {
		b.Fatal(err)
	}
	b.Cleanup(func() { s.Close() })
	stageCapacity(b, s, chunks, now)
	if _, err = s.CommitSnapshot(b.Context(), manifest, now); err != nil {
		b.Fatal(err)
	}
	for start := 0; start < 4096; start += 256 {
		records := make([]model.Record, 0, 256)
		for index := start; index < start+256; index++ {
			id := fmt.Sprintf("devices:%064x", index)
			device := model.Device{ID: id, Name: "Capacity fixture", ObservedAt: now, LastSeen: now, Status: "observed", Addresses: []model.Address{}}
			body, err := json.Marshal(device)
			if err != nil {
				b.Fatal(err)
			}
			records = append(records, model.Record{ID: id, Kind: "device", ObservedAt: now, Data: body})
		}
		sequence := uint64(start/256 + 1)
		if _, err = s.Ingest(b.Context(), model.Batch{Version: 1, SourceID: "devices", BootID: "capacity-boot", Sequence: sequence, Cursor: fmt.Sprint(sequence), SamplingRate: 1, Records: records}, now); err != nil {
			b.Fatal(err)
		}
	}
	b.ResetTimer()
	b.StartTimer()
	return s
}

func BenchmarkCurrentDeviceCapacity(b *testing.B) {
	s := capacityQueryStore(b)
	b.ReportAllocs()
	for b.Loop() {
		rows, err := s.Query(b.Context(), "device", Query{Limit: 500})
		if err != nil || len(rows) != 500 {
			b.Fatalf("device page: %d, %v", len(rows), err)
		}
	}
}

func BenchmarkDevicePolicyCapacity(b *testing.B) {
	s := capacityQueryStore(b)
	b.ReportAllocs()
	query := Query{DeviceID: fmt.Sprintf("devices:%064x", 4095), Limit: 500}
	for b.Loop() {
		rows, err := s.PolicyViews(b.Context(), query)
		if err != nil || len(rows) != 8 {
			b.Fatalf("device policy: %d, %v", len(rows), err)
		}
	}
}

func BenchmarkHistoricalDevicePolicyCapacity(b *testing.B) {
	s := capacityQueryStore(b)
	b.ReportAllocs()
	query := Query{History: true, DeviceID: fmt.Sprintf("devices:%064x", 4095), Limit: 500}
	for b.Loop() {
		rows, err := s.Query(b.Context(), "policy", query)
		if err != nil || len(rows) != 8 {
			b.Fatalf("device policy history: %d, %v", len(rows), err)
		}
	}
}

func BenchmarkDevicePolicyCapacityDuringRetention(b *testing.B) {
	s := capacityQueryStore(b)
	b.StopTimer()
	ctx, cancel := context.WithCancel(b.Context())
	done := make(chan error, 1)
	go func() {
		for {
			if err := s.Maintenance(ctx, time.Now().UTC()); err != nil {
				if ctx.Err() != nil {
					err = nil
				}
				done <- err
				return
			}
			select {
			case <-ctx.Done():
				done <- nil
				return
			case <-time.After(100 * time.Millisecond):
			}
		}
	}()
	defer func() {
		cancel()
		if err := <-done; err != nil {
			b.Error(err)
		}
	}()
	query := Query{DeviceID: fmt.Sprintf("devices:%064x", 4095), Limit: 500}
	b.ReportAllocs()
	b.StartTimer()
	for b.Loop() {
		rows, err := s.PolicyViews(b.Context(), query)
		if err != nil || len(rows) != 8 {
			b.Fatalf("device policy during maintenance: %d, %v", len(rows), err)
		}
	}
	b.StopTimer()
}
