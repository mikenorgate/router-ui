//go:build integration

package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

func intervalBatch(t testing.TB, seq uint64, at time.Time, status string) model.Batch {
	t.Helper()
	v := model.TrafficInterval{ID: fmt.Sprintf("interval-%d", at.Unix()), DeviceID: "device-1", Segment: "lab", Namespace: "host", ObservationPoint: "conntrack-original", Family: "4", From: at, To: at.Add(30 * time.Second), BytesSent: 100, BytesReceived: 200, CounterStatus: status, SamplingRate: 1}
	if status != "measured" {
		v.BytesSent, v.BytesReceived = 0, 0
	}
	data, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	return model.Batch{Version: 1, SourceID: "traffic", BootID: "boot-1", Sequence: seq, SamplingRate: 1, Records: []model.Record{{ID: v.ID, Kind: "traffic_interval", ObservedAt: v.To, Data: data}}}
}
func trafficTotals(t testing.TB, s *Store, from, to time.Time) (uint64, uint64, int) {
	t.Helper()
	rows, _, truncated, err := s.Traffic(context.Background(), Query{From: from, To: to})
	if err != nil || truncated {
		t.Fatalf("traffic %v truncated=%v", err, truncated)
	}
	var sent, received uint64
	gaps := 0
	for _, row := range rows {
		if row.Time.IsZero() {
			sent += row.Sent
			received += row.Received
			gaps += row.Gaps
		}
	}
	return sent, received, gaps
}
func TestIntervalReplayResetAndCompletedFlowSeparation(t *testing.T) {
	s := testStore(t)
	ctx := t.Context()
	at := time.Now().UTC().Truncate(time.Minute).Add(-time.Minute)
	first := intervalBatch(t, 1, at, "measured")
	if err := first.Validate(time.Now(), []string{"traffic_interval"}); err != nil {
		t.Fatal(err)
	}
	if _, err := s.Ingest(ctx, first, time.Now()); err != nil {
		t.Fatal(err)
	}
	first.Sequence = 2
	if _, err := s.Ingest(ctx, first, time.Now()); err != nil {
		t.Fatal(err)
	}
	second := intervalBatch(t, 3, at.Add(30*time.Second), "measured")
	if _, err := s.Ingest(ctx, second, time.Now()); err != nil {
		t.Fatal(err)
	}
	first.Sequence = 4
	if _, err := s.Ingest(ctx, first, time.Now()); err != nil {
		t.Fatal(err)
	} // replay after a later interval
	reset := intervalBatch(t, 5, at.Add(time.Minute), "reset")
	if _, err := s.Ingest(ctx, reset, time.Now()); err != nil {
		t.Fatal(err)
	}
	flow := flowBatch(t, 1, "completed")
	if _, err := s.Ingest(ctx, flow, time.Now()); err != nil {
		t.Fatal(err)
	}
	sent, received, gaps := trafficTotals(t, s, at, at.Add(2*time.Minute))
	if sent != 200 || received != 400 || gaps != 1 {
		t.Fatalf("deltas=%d/%d gaps=%d", sent, received, gaps)
	}
	completed, err := s.Summaries(ctx, Query{From: at.Truncate(time.Hour), To: time.Now()})
	if err != nil || len(completed) != 1 || completed[0].Sent != 100 {
		t.Fatalf("completed summaries %+v %v", completed, err)
	}
	if err = s.Maintenance(ctx, time.Now().Add(3*time.Hour)); err != nil {
		t.Fatal(err)
	}
	first.Sequence = 6
	if _, err = s.Ingest(ctx, first, time.Now().Add(3*time.Hour)); err == nil {
		t.Fatal("evicted interval cursor allowed old accounting again")
	}
}
func TestIntervalConflictOverlapOverflowAndRollback(t *testing.T) {
	for _, name := range []string{"conflict", "overlap", "overflow"} {
		t.Run(name, func(t *testing.T) {
			s := testStore(t)
			at := time.Now().UTC().Truncate(time.Minute).Add(-time.Minute)
			b := intervalBatch(t, 1, at, "measured")
			if _, err := s.Ingest(t.Context(), b, time.Now()); err != nil {
				t.Fatal(err)
			}
			bad := intervalBatch(t, 2, at.Add(30*time.Second), "measured")
			var v model.TrafficInterval
			if err := json.Unmarshal(bad.Records[0].Data, &v); err != nil {
				t.Fatal(err)
			}
			switch name {
			case "conflict":
				v.From, v.To = at, at.Add(30*time.Second)
				v.BytesSent = 101
			case "overlap":
				v.From = at.Add(15 * time.Second)
			case "overflow":
				if _, err := s.history.Exec("UPDATE traffic_minutes SET sent=?", int64(1<<62)); err != nil {
					t.Fatal(err)
				}
			}
			bad.Records[0].ObservedAt = v.To
			bad.Records[0].Data, _ = json.Marshal(v)
			if _, err := s.Ingest(t.Context(), bad, time.Now()); err == nil {
				t.Fatal("invalid delta acknowledged")
			}
			sources, err := s.Sources(t.Context(), time.Now())
			if err != nil || sources[0].LastSequence != 1 {
				t.Fatalf("failed write advanced cursor %+v %v", sources, err)
			}
		})
	}
}
func TestActiveConnectionPromotionAndObservationIdentity(t *testing.T) {
	s := testStore(t)
	ctx := t.Context()
	b := flowBatch(t, 1, "same-id")
	var f model.Flow
	if err := json.Unmarshal(b.Records[0].Data, &f); err != nil {
		t.Fatal(err)
	}
	f.State = "active"
	f.SourceID = "impersonated"
	b.Records[0].Data, _ = json.Marshal(f)
	if _, err := s.Ingest(ctx, b, time.Now()); err != nil {
		t.Fatal(err)
	}
	items, err := s.Query(ctx, "flow", Query{State: "active"})
	if err != nil || len(items) != 1 {
		t.Fatalf("active %+v %v", items, err)
	}
	var result struct {
		Ref    string `json:"observation_ref"`
		Source string `json:"source_id"`
	}
	if err = json.Unmarshal(items[0], &result); err != nil {
		t.Fatal(err)
	}
	if result.Source != "test" {
		t.Fatal("body forged source identity")
	}
	o, err := s.Observation(ctx, result.Ref)
	if err != nil || o.Identity.Boot != "boot-1" || o.Identity.ID != "same-id" {
		t.Fatalf("lookup %+v %v", o, err)
	}
	if count, err := s.FlowCount(ctx, time.Now().Add(-time.Hour)); err != nil || count != 0 {
		t.Fatalf("active flow counted as completed %d %v", count, err)
	}
	f.State = "completed"
	b.Sequence = 2
	b.Records[0].Data, _ = json.Marshal(f)
	if _, err = s.Ingest(ctx, b, time.Now()); err != nil {
		t.Fatal(err)
	}
	items, err = s.Query(ctx, "flow", Query{State: "active"})
	if err != nil || len(items) != 0 {
		t.Fatal("completed connection remains active")
	}
	// Its original snapshot reference still resolves to the final record at
	// the same envelope identity, independently of pagination.
	if _, err = s.Observation(ctx, result.Ref); err != nil {
		t.Fatal(err)
	}
	b.BootID = "boot-2"
	b.Sequence = 1
	f.BytesSent = 300
	b.Records[0].Data, _ = json.Marshal(f)
	if _, err = s.Ingest(ctx, b, time.Now()); err != nil {
		t.Fatal(err)
	}
	o, err = s.Observation(ctx, result.Ref)
	if err != nil || o.Identity.Boot != "boot-1" {
		t.Fatal("cross-boot identity collided")
	}
}
func TestObservationLookupOutsidePageAndRetention(t *testing.T) {
	s := testStore(t)
	b := flowBatch(t, 1, "older", "newer")
	b.Records[0].ObservedAt = time.Now().Add(-48 * time.Hour)
	if _, err := s.Ingest(t.Context(), b, time.Now()); err != nil {
		t.Fatal(err)
	}
	items, err := s.Query(t.Context(), "flow", Query{RecordID: "older", Limit: 1})
	if err != nil || len(items) != 1 {
		t.Fatal(err)
	}
	var v struct {
		Ref string `json:"observation_ref"`
	}
	if err = json.Unmarshal(items[0], &v); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Observation(t.Context(), v.Ref); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Observation(t.Context(), "not-a-reference"); !errors.Is(err, ErrReference) {
		t.Fatal("malformed reference accepted")
	}
	if err = s.SetRetention(t.Context(), 1, 1, "test"); err != nil {
		t.Fatal(err)
	}
	if err = s.Maintenance(t.Context(), time.Now()); err != nil {
		t.Fatal(err)
	}
	if _, err = s.Observation(t.Context(), v.Ref); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("expired reference %v", err)
	}
}
func TestEventAndDNSFiltersBeforePagination(t *testing.T) {
	s := testStore(t)
	now := time.Now().UTC()
	b := model.Batch{Version: 1, SourceID: "events", BootID: "boot", Sequence: 1, SamplingRate: 1}
	for i := range 150 {
		e := model.Event{ID: fmt.Sprintf("e%d", i), Time: now, Kind: "service", Severity: "info", Title: "Public", Detail: "secret-marker"}
		if i == 0 {
			e.Kind, e.Severity = "telemetry", "error"
		}
		data, _ := json.Marshal(e)
		b.Records = append(b.Records, model.Record{ID: e.ID, Kind: "event", ObservedAt: now.Add(time.Duration(i)*time.Millisecond - time.Second), Data: data})
	}
	if _, err := s.Ingest(t.Context(), b, now); err != nil {
		t.Fatal(err)
	}
	items, err := s.Query(t.Context(), "event", Query{EventKind: "telemetry", Severity: "error", Limit: 1})
	if err != nil || len(items) != 1 {
		t.Fatalf("server event filters %d %v", len(items), err)
	}
	items, err = s.Query(t.Context(), "event", Query{PublicEvents: true, Q: "secret-marker", Limit: 1})
	if err != nil || len(items) != 0 {
		t.Fatal("Viewer search revealed private event detail")
	}
	d := model.DNS{ID: "dns", Query: "example.test", Type: "AAAA", Result: "NXDOMAIN", Resolver: "local", ObservedAt: now}
	data, _ := json.Marshal(d)
	b.Sequence = 2
	b.Records = []model.Record{{ID: d.ID, Kind: "dns", ObservedAt: now, Data: data}}
	if _, err = s.Ingest(t.Context(), b, now); err != nil {
		t.Fatal(err)
	}
	items, err = s.Query(t.Context(), "dns", Query{RCode: "NXDOMAIN", Resolver: "local", Limit: 1})
	if err != nil || len(items) != 1 {
		t.Fatal("DNS filters missing matching row")
	}
}

func BenchmarkActivityIntervalBatch(b *testing.B) {
	dir := b.TempDir()
	s, err := Open(dir+"/state", dir+"/history", 256<<20, 8<<20, 7, 90)
	if err != nil {
		b.Fatal(err)
	}
	defer s.Close()
	at := time.Now().UTC().Truncate(time.Minute).Add(-time.Minute)
	batch := intervalBatch(b, 1, at, "measured")
	batch.Records = nil
	for i := range 256 {
		v := intervalBatch(b, 1, at, "measured").Records[0]
		var interval model.TrafficInterval
		if err = json.Unmarshal(v.Data, &interval); err != nil {
			b.Fatal(err)
		}
		interval.ID = fmt.Sprintf("i%d", i)
		interval.DeviceID = fmt.Sprintf("d%d", i)
		v.ID = interval.ID
		v.Data, _ = json.Marshal(interval)
		batch.Records = append(batch.Records, v)
	}
	b.ReportAllocs()
	for b.Loop() {
		batch.Sequence++
		batch.BootID = fmt.Sprintf("boot-%d", batch.Sequence)
		if _, err = s.Ingest(context.Background(), batch, time.Now()); err != nil {
			b.Fatal(err)
		}
	}
}

func TestCompletedConnectionRejectsLaterActiveReplay(t *testing.T) {
	for _, sameBatch := range []bool{false, true} {
		t.Run(fmt.Sprint(sameBatch), func(t *testing.T) {
			s := testStore(t)
			b := flowBatch(t, 1, "replayed")
			var f model.Flow
			_ = json.Unmarshal(b.Records[0].Data, &f)
			f.State = "completed"
			b.Records[0].Data, _ = json.Marshal(f)
			active := b.Records[0]
			f.State = "active"
			active.Data, _ = json.Marshal(f)
			if sameBatch {
				b.Records = append(b.Records, active)
			}
			if _, err := s.Ingest(t.Context(), b, time.Now()); err != nil {
				t.Fatal(err)
			}
			if !sameBatch {
				b.Sequence = 2
				b.Records = []model.Record{active}
				if _, err := s.Ingest(t.Context(), b, time.Now()); err != nil {
					t.Fatal(err)
				}
			}
			rows, err := s.Query(t.Context(), "flow", Query{State: "active"})
			if err != nil || len(rows) != 0 {
				t.Fatalf("completed identity resurrected: %s %v", rows, err)
			}
			rows, err = s.Query(t.Context(), "flow", Query{State: "completed"})
			if err != nil || len(rows) != 1 {
				t.Fatalf("completion lost: %s %v", rows, err)
			}
		})
	}
}
func TestActiveExpiryAtReadWithoutMaintenance(t *testing.T) {
	s := testStore(t)
	b := flowBatch(t, 1, "expired")
	b.Records[0].ObservedAt = time.Now().Add(-91 * time.Second)
	var f model.Flow
	_ = json.Unmarshal(b.Records[0].Data, &f)
	f.State = "active"
	b.Records[0].Data, _ = json.Marshal(f)
	if _, err := s.Ingest(t.Context(), b, b.Records[0].ObservedAt); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := s.history.QueryRow("SELECT COUNT(*) FROM active_connections").Scan(&count); err != nil || count != 1 {
		t.Fatal("fixture did not preserve stale row", err)
	}
	rows, err := s.Query(t.Context(), "flow", Query{State: "active"})
	if err != nil || len(rows) != 0 {
		t.Fatal("stale active listed", err)
	}
	ref := observationRef(b.SourceID, b.BootID, "expired", "flow", b.Records[0].ObservedAt.UnixNano())
	if _, err = s.Observation(t.Context(), ref); !errors.Is(err, sql.ErrNoRows) {
		t.Fatalf("stale reference resolved: %v", err)
	}
}
func TestIntervalRangeBoundAndBucketConvention(t *testing.T) {
	s := testStore(t)
	now := time.Now().UTC()
	at := now.Truncate(time.Hour).Add(-time.Hour - time.Second*10)
	// A capture crossing an hour belongs wholly to its start bucket.
	for i := range 2 {
		b := intervalBatch(t, uint64(i+1), at.Add(time.Duration(i)*time.Hour), "measured")
		var v model.TrafficInterval
		_ = json.Unmarshal(b.Records[0].Data, &v)
		v.BytesSent = uint64(maxTrafficBucketBytes)
		b.Records[0].Data, _ = json.Marshal(v)
		if _, err := s.Ingest(t.Context(), b, now); err != nil {
			t.Fatal(err)
		}
	}
	sent, _, _ := trafficTotals(t, s, at.Add(-time.Minute), now)
	if sent != 2*uint64(maxTrafficBucketBytes) {
		t.Fatal("range lost exact integer bytes", sent)
	}
	rows, _, _, err := s.Traffic(t.Context(), Query{From: at.Add(-time.Minute), To: now})
	if err != nil {
		t.Fatal(err)
	}
	found := false
	for _, r := range rows {
		if !r.Time.IsZero() && r.Time.Equal(at.Truncate(time.Minute)) {
			found = true
		}
	}
	if !found {
		t.Fatal("cross-boundary delta not in start bucket")
	}
	bad := intervalBatch(t, 3, now.Add(-30*time.Second), "measured")
	var v model.TrafficInterval
	_ = json.Unmarshal(bad.Records[0].Data, &v)
	v.BytesSent = 1 << 62
	bad.Records[0].Data, _ = json.Marshal(v)
	if _, err = s.Ingest(t.Context(), bad, now); !errors.Is(err, ErrCapacity) {
		t.Fatal("range-unsafe bytes accepted", err)
	}
	sources, err := s.Sources(t.Context(), now)
	if err != nil || sources[0].LastSequence != 2 {
		t.Fatal("rejected accounting advanced ACK", sources, err)
	}
}
func TestRetainedDeviceCountsAcrossPartitionsAndSampling(t *testing.T) {
	s := testStore(t)
	now := time.Now().UTC()
	b := model.Batch{Version: 1, SourceID: "dns", BootID: "boot", Sequence: 1, SamplingRate: 0.5}
	for i := range 20 {
		at := now.Add(-time.Duration(i) * time.Hour)
		d := model.DNS{ID: fmt.Sprint("d", i), DeviceID: "device-1", Query: "fixture.test", Type: "A", Result: "NOERROR"}
		body, _ := json.Marshal(d)
		b.Records = append(b.Records, model.Record{ID: d.ID, Kind: "dns", ObservedAt: at, Data: body})
	}
	if _, err := s.Ingest(t.Context(), b, now); err != nil {
		t.Fatal(err)
	}
	q := Query{DeviceID: "device-1", From: now.Add(-25 * time.Hour), To: now, Limit: 100}
	counts, err := s.ActivityCounts(t.Context(), q, "dns", 3600)
	if err != nil {
		t.Fatal(err)
	}
	var count uint64
	for _, c := range counts {
		count += c.Count
	}
	if count != 20 {
		t.Fatal("source sampling incorrectly extrapolated", count)
	}
	q.DeviceID = "other"
	counts, err = s.ActivityCounts(t.Context(), q, "dns", 3600)
	if err != nil || len(counts) != 0 {
		t.Fatal("device counts crossed identity", counts, err)
	}
	q.DeviceID = "device-1"
	q.From = now.Add(-2 * time.Hour)
	counts, err = s.ActivityCounts(t.Context(), q, "dns", 60)
	if err != nil {
		t.Fatal(err)
	}
	count = 0
	for _, c := range counts {
		count += c.Count
	}
	if count != 3 {
		t.Fatal("window not applied", count)
	}
	if err = s.SetRetention(t.Context(), 1, 1, "test"); err != nil {
		t.Fatal(err)
	}
	if err = s.Maintenance(t.Context(), now.Add(48*time.Hour)); err != nil {
		t.Fatal(err)
	}
	counts, err = s.ActivityCounts(t.Context(), q, "dns", 60)
	if err != nil || len(counts) != 0 {
		t.Fatal("expired observations counted", counts, err)
	}
}

func TestWithinBucketMissingIntervalsArePartial(t *testing.T) {
	s := testStore(t)
	now := time.Now().UTC()
	at := now.Truncate(time.Minute).Add(-time.Minute)
	for i := range 2 {
		b := intervalBatch(t, uint64(i+1), at.Add(time.Duration(i)*32*time.Second), "measured")
		var interval model.TrafficInterval
		_ = json.Unmarshal(b.Records[0].Data, &interval)
		interval.To = interval.From.Add(16 * time.Second)
		b.Records[0].ObservedAt = interval.To
		b.Records[0].Data, _ = json.Marshal(interval)
		if _, err := s.Ingest(t.Context(), b, now); err != nil {
			t.Fatal(err)
		}
	}
	rows, _, _, err := s.Traffic(t.Context(), Query{From: at, To: now})
	if err != nil {
		t.Fatal(err)
	}
	for _, row := range rows {
		if row.Gaps == 0 {
			t.Fatal("unobserved part of bucket hidden", row)
		}
	}
}
func BenchmarkRecordedPolicyProvenanceCapacity(b *testing.B) {
	s := capacityQueryStore(b)
	b.ReportAllocs()
	q := Query{History: true, RecordID: "test:rule-0", PolicyDefinition: true, PolicyRevision: "fixture-revision", To: time.Now(), Limit: 1}
	for b.Loop() {
		rows, err := s.Query(b.Context(), "policy", q)
		if err != nil || len(rows) != 1 {
			b.Fatal("historical provenance", len(rows), err)
		}
	}
}

func TestRetainedDecisionCountsRequireDirectBlockedEvidence(t *testing.T) {
	s := testStore(t)
	now := time.Now().UTC()
	b := flowBatch(t, 1, "blocked", "completed", "unknown", "unqualified")
	for i := range b.Records {
		var f model.Flow
		_ = json.Unmarshal(b.Records[i].Data, &f)
		f.State = "decision"
		f.Verdict = "blocked"
		f.DecisionSource = "nft-log"
		if i == 1 {
			f.State = "completed"
		}
		if i == 2 {
			f.Verdict = "unknown"
		}
		if i == 3 {
			f.DecisionSource = ""
		}
		b.Records[i].Data, _ = json.Marshal(f)
	}
	if _, err := s.Ingest(t.Context(), b, now); err != nil {
		t.Fatal(err)
	}
	counts, err := s.ActivityCounts(t.Context(), Query{DeviceID: "device-1", From: now.Add(-time.Hour), To: time.Now()}, "decision", 60)
	if err != nil || len(counts) != 1 || counts[0].Count != 1 {
		t.Fatal("unqualified verdict counted", counts, err)
	}
}
