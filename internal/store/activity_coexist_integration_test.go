//go:build integration && capacity && linux

package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/mikenorgate/router-ui/internal/model"
	"os"
	"path/filepath"
	"sort"
	"sync"
	"testing"
	"time"
)

// The caller clones a closed, synthetic capacity fixture. Never point this
// opt-in qualification at appliance state or share it with another writer.
func TestActivityPolicyCoexistence(t *testing.T) {
	directory := os.Getenv("ROUTER_ACTIVITY_COEXIST")
	if directory == "" {
		t.Skip("explicit cloned synthetic fixture only")
	}
	validateCapacityLimits(t)
	data, err := os.ReadFile(filepath.Join(directory, "qualification.json"))
	if err != nil {
		t.Fatal(err)
	}
	var marker struct {
		Scope    string `json:"scope"`
		Accepted int    `json:"accepted"`
	}
	if json.Unmarshal(data, &marker) != nil || marker.Scope != "Local SQLite metadata only; no physical router or forwarding tests" || marker.Accepted < 600000 {
		t.Fatal("not a qualified synthetic fixture")
	}
	s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 16<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	now := time.Now().UTC()
	sources, err := s.Sources(t.Context(), now)
	if err != nil {
		t.Fatal(err)
	}
	var sequence uint64
	for _, source := range sources {
		if source.ID == "active-capacity" {
			sequence = source.LastSequence
		}
	}
	// Refresh the synthetic seed before measured work; ingestion maintains it.
	if _, err = s.history.ExecContext(t.Context(), "UPDATE active_connections SET time=?", now.UnixNano()); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(t.Context())
	defer cancel()
	type queued struct {
		batch model.Batch
		at    time.Time
	}
	queue := make(chan queued, 128)
	var producer, consumer, reader sync.WaitGroup
	var mu sync.Mutex
	accepted, produced, retries := 0, 0, 0
	peakVisibility := 0.0
	failures := []string{}
	queries := []float64{}
	fail := func(err error) { mu.Lock(); failures = append(failures, err.Error()); mu.Unlock() }
	producer.Add(1)
	go func() {
		defer producer.Done()
		defer close(queue)
		tick := time.NewTicker(256 * time.Millisecond)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				sequence++
				at := time.Now().UTC()
				b := model.Batch{Version: 1, SourceID: "active-capacity", BootID: "capacity-boot", Sequence: sequence, SamplingRate: 1}
				for i := range 256 {
					id := fmt.Sprint("coexist-", sequence, "-", i)
					kind := "event"
					var value any = model.Event{ID: id, Time: at, Kind: "network", Title: "Synthetic coexistence event"}
					if i < 192 {
						slot := (int(sequence)*192 + i) % 65536
						id = fmt.Sprint("connection-", slot)
						kind = "flow"
						value = model.Flow{ID: id, DeviceID: fmt.Sprint("device-", slot%4096), SourceIP: "192.0.2.10", DestinationIP: "203.0.113.10", StartedAt: now.Add(-time.Hour), LastSeen: at, Verdict: "unknown", State: "active", SamplingRate: 1}
					}
					body, _ := json.Marshal(value)
					b.Records = append(b.Records, model.Record{ID: id, Kind: kind, ObservedAt: at, Data: body})
				}
				select {
				case queue <- queued{b, time.Now()}:
					produced += len(b.Records)
				case <-ctx.Done():
					return
				}
			}
		}
	}()
	consumer.Add(1)
	go func() {
		defer consumer.Done()
		for item := range queue {
			for attempt := range 8 {
				request, stop := context.WithTimeout(t.Context(), 4*time.Second)
				result, err := s.Ingest(request, item.batch, time.Now())
				stop()
				if err == nil {
					accepted += result.Accepted
					peakVisibility = max(peakVisibility, time.Since(item.at).Seconds())
					break
				}
				retries++
				if attempt == 7 {
					fail(fmt.Errorf("ingest replay: %w", err))
					return
				}
			}
		}
	}()
	reader.Add(1)
	go func() {
		defer reader.Done()
		tick := time.NewTicker(2 * time.Second)
		defer tick.Stop()
		for {
			select {
			case <-ctx.Done():
				return
			case <-tick.C:
				request, stop := context.WithTimeout(t.Context(), 4*time.Second)
				started := time.Now()
				_, _, truncated, err := s.Traffic(request, Query{From: now.Add(-3 * time.Hour), To: time.Now()})
				elapsed := time.Since(started).Seconds()
				stop()
				mu.Lock()
				queries = append(queries, elapsed)
				mu.Unlock()
				if err != nil || truncated {
					fail(fmt.Errorf("summary during policy: truncated=%v %v", truncated, err))
				}
			}
		}
	}()
	defer func() { cancel(); producer.Wait(); consumer.Wait(); reader.Wait() }()
	chunks, manifest := capacitySnapshot(t, time.Now().UTC())
	timings := map[string]float64{}
	for _, operation := range []string{"initial", "shared-rule-revision", "complete-removal"} {
		if operation != "initial" {
			chunks, manifest = nextCapacitySnapshot(t, chunks, manifest, operation)
		}
		stageCapacity(t, s, chunks, manifest.ObservedAt)
		request, stop := context.WithTimeout(t.Context(), 8*time.Second)
		started := time.Now()
		result, err := s.CommitSnapshot(request, manifest, manifest.ObservedAt)
		timings[operation] = time.Since(started).Seconds()
		stop()
		if err != nil || result.Accepted != manifest.Records || timings[operation] > 8 {
			t.Fatalf("%s exceeds publication gate: %.3fs accepted=%d %v", operation, timings[operation], result.Accepted, err)
		}
	}
	// Collect a useful query distribution after the three one-off publications.
	select {
	case <-time.After(60 * time.Second):
	case <-t.Context().Done():
		t.Fatal(t.Context().Err())
	}
	cancel()
	producer.Wait()
	consumer.Wait()
	reader.Wait()
	sort.Float64s(queries)
	p95 := queries[min(len(queries)-1, int(float64(len(queries))*.95))]
	result := map[string]any{"scope": "Cloned synthetic million-record fixture; 1CPU/2GiB/no swap; no forwarding", "policy_seconds": timings, "query_p95_seconds": p95, "queries": len(queries), "produced": produced, "accepted": accepted, "retry_attempts": retries, "visibility_max_seconds": peakVisibility, "errors": failures}
	body, _ := json.MarshalIndent(result, "", "  ")
	if err = os.WriteFile(filepath.Join(directory, "coexistence.json"), body, 0600); err != nil {
		t.Fatal(err)
	}
	t.Log(string(body))
	if p95 >= 2 || accepted != produced || peakVisibility > 90 || len(failures) > 0 {
		t.Fatal("coexistence acceptance failed")
	}
}
