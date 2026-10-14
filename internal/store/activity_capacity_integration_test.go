//go:build integration

package store

import (
	"context"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"runtime/pprof"
	"sort"
	"strconv"
	"sync"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

// This opt-in qualification is deliberately excluded from ordinary unit runs.
// It uses only disposable SQLite files and synthetic metadata, never routing,
// an external receiver, a physical appliance or forwarding load.
func TestActivityCapacity(t *testing.T) {
	if os.Getenv("ROUTER_ACTIVITY_QUALIFY") != "1" {
		t.Skip("explicit local capacity qualification only")
	}
	duration := 600
	if value := os.Getenv("ROUTER_ACTIVITY_SECONDS"); value != "" {
		n, err := strconv.Atoi(value)
		if err != nil || n < 10 || n > 1800 {
			t.Fatal("invalid qualification duration")
		}
		duration = n
	}
	directory := t.TempDir()
	if output := os.Getenv("ROUTER_ACTIVITY_OUTPUT"); output != "" {
		directory = output
		if err := os.MkdirAll(directory, 0700); err != nil {
			t.Fatal(err)
		}
	}
	s, err := Open(filepath.Join(directory, "state"), filepath.Join(directory, "history"), 3<<30, 16<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := t.Context()
	now := time.Now().UTC()
	at := now.Add(-30 * time.Minute)
	table := partition(at)
	seed := flowBatch(t, 1, "seed")
	seed.SourceID, seed.BootID = "capacity", "capacity-boot"
	seed.Records[0].ObservedAt = at
	if _, err = s.Ingest(ctx, seed, now); err != nil {
		t.Fatal(err)
	}
	// Bulk SQL is fixture construction only. Measured ingest always uses the
	// actual transactional Store.Ingest entrypoint and real normalized batches.
	if _, err = s.history.ExecContext(ctx, `WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<999998)
INSERT INTO `+table+` SELECT 'capacity','capacity-boot','capacity-'||x,'flow',?+x*1000,'device-'||(x%4096),x,
json_object('id','capacity-'||x,'device_id','device-'||(x%4096),'source_ip',CASE WHEN x%64=0 THEN '2001:db8::10' ELSE '192.0.2.10' END,'destination_ip','203.0.113.10','source_port',12345,'destination_port',443,'protocol','TCP','bytes_sent',100,'bytes_received',200,'started_at',?,'last_seen',?,'verdict',CASE WHEN x%128=0 THEN 'blocked' ELSE 'unknown' END,'rule_id','','state','completed','sampling_rate',1,'evidence','synthetic retained capacity fixture') FROM n`, at.UnixNano(), at.Format(time.RFC3339Nano), at.Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	if _, err = s.history.ExecContext(ctx, `WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<65535)
INSERT INTO active_connections SELECT 'active-capacity','capacity-boot','connection-'||x,?,'device-'||(x%4096),json_object('id','connection-'||x,'device_id','device-'||(x%4096),'source_ip','192.0.2.10','destination_ip','203.0.113.10','source_port',12345,'destination_port',443,'protocol','TCP','bytes_sent',100,'bytes_received',200,'started_at',?,'last_seen',?,'verdict','unknown','rule_id','','state','active','sampling_rate',1,'evidence','synthetic active capacity fixture') FROM n`, now.UnixNano(), at.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	// Populate a full hour of per-device minute rows (245,760), plus hourly
	// history, so the summary query measures actual ranking/series aggregation.
	if _, err = s.history.ExecContext(ctx, `WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<245759)
INSERT INTO traffic_minutes SELECT ?+(x/4096)*60,'accounting','device-'||(x%4096),'host',0,'conntrack-original','4','lab',100,200,16,0,30,1 FROM n;
UPDATE settings SET value=(SELECT COUNT(*) FROM traffic_minutes) WHERE key='traffic_minutes_count';`, now.Truncate(time.Minute).Add(-time.Hour).Unix()); err != nil {
		t.Fatal(err)
	}
	if _, err = s.history.ExecContext(ctx, `WITH RECURSIVE n(x) AS (VALUES(0) UNION ALL SELECT x+1 FROM n WHERE x<4095)
INSERT INTO latest SELECT 'device','device-'||x,'devices',?,json_object('id','device-'||x,'name','Synthetic device '||x,'segment','lab','mac','','addresses',json('[]'),'last_seen',?,'observed_at',?,'status','observed','sources',json('[]')) FROM n`, now.UnixNano(), now.Format(time.RFC3339Nano), now.Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	if _, err = s.history.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		t.Fatal(err)
	}
	t.Log("Seeded 1,000,000 historical records, 65,536 active connections, 4,096 devices and 245,760 minute aggregates")
	var fixtureActive int
	if err = s.read.QueryRowContext(ctx, "SELECT COUNT(*) FROM active_connections").Scan(&fixtureActive); err != nil || fixtureActive != 65536 {
		t.Fatal("active fixture incomplete", err)
	}
	var mu sync.Mutex
	latencies := map[string][]float64{}
	errors := []string{}
	stop := make(chan struct{})
	var workers sync.WaitGroup
	queries := map[string]func(context.Context) error{
		"device_flows": func(ctx context.Context) error {
			_, err := s.Query(ctx, "flow", Query{DeviceID: "device-123", From: at.Add(-time.Minute), To: time.Now().Add(time.Second), Limit: 100})
			return err
		},
		"filtered_flows": func(ctx context.Context) error {
			_, err := s.Query(ctx, "flow", Query{Verdict: "blocked", Family: "6", Protocol: "TCP", From: at.Add(-time.Minute), To: time.Now().Add(time.Second), Limit: 100})
			return err
		},
		"interval_summary": func(ctx context.Context) error {
			_, _, truncated, err := s.Traffic(ctx, Query{From: time.Now().Add(-time.Hour), To: time.Now()})
			if truncated {
				return fmt.Errorf("summary truncated")
			}
			return err
		},
		"direct_observation": func(ctx context.Context) error {
			_, err := s.Observation(ctx, observationRef("capacity", "capacity-boot", "capacity-500000", "flow", at.UnixNano()+500000*1000))
			return err
		},
	}
	for name, query := range queries {
		workers.Add(1)
		go func() {
			defer workers.Done()
			ticker := time.NewTicker(2 * time.Second)
			defer ticker.Stop()
			for {
				select {
				case <-stop:
					return
				case <-ticker.C:
					started := time.Now()
					request, cancel := context.WithTimeout(ctx, 4*time.Second)
					err := query(request)
					cancel()
					elapsed := time.Since(started).Seconds()
					mu.Lock()
					latencies[name] = append(latencies[name], elapsed)
					if err != nil {
						errors = append(errors, name+": "+err.Error())
					}
					mu.Unlock()
				}
			}
		}()
	}
	workers.Add(1)
	go func() {
		defer workers.Done()
		ticker := time.NewTicker(30 * time.Second)
		defer ticker.Stop()
		for {
			select {
			case <-stop:
				return
			case <-ticker.C:
				request, cancel := context.WithTimeout(ctx, 8*time.Second)
				err := s.Maintenance(request, time.Now())
				cancel()
				if err != nil {
					mu.Lock()
					errors = append(errors, "retention: "+err.Error())
					mu.Unlock()
				}
			}
		}
	}()
	if _, err = s.history.ExecContext(ctx, "UPDATE active_connections SET time=?,body=json_set(body,'$.last_seen',?)", time.Now().UnixNano(), time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		t.Fatal(err)
	}
	if os.Getenv("ROUTER_ACTIVITY_PROFILE") == "1" {
		file, err := os.Create(filepath.Join(directory, "load-cpu.pprof"))
		if err != nil {
			t.Fatal(err)
		}
		if err = pprof.StartCPUProfile(file); err != nil {
			t.Fatal(err)
		}
		defer func() { pprof.StopCPUProfile(); file.Close() }()
	}
	started := time.Now()
	type queuedBatch struct {
		batch model.Batch
		at    time.Time
	}
	queue := make(chan queuedBatch, 128)
	producerCtx, cancelProducer := context.WithCancel(ctx)
	defer cancelProducer()
	produced, burstProduced, queuePeak := 0, 0, 0
	var producer sync.WaitGroup
	producer.Add(1)
	go func() {
		defer producer.Done()
		defer close(queue)
		sequence := uint64(0)
		scheduled := started
		for time.Since(started) < time.Duration(duration)*time.Second {
			sequence++
			batch := model.Batch{Version: 1, SourceID: "active-capacity", BootID: "capacity-boot", Sequence: sequence, SamplingRate: 1, Coverage: "Local synthetic capacity qualification"}
			when := time.Now().UTC()
			for i := range 256 {
				id := fmt.Sprintf("load-%d-%d", sequence, i)
				e := model.Event{ID: id, Time: when, Kind: "network", Severity: "info", Title: "Synthetic network event", Detail: "Bounded synthetic metadata", DeviceID: fmt.Sprintf("device-%d", (int(sequence)*128+i)%4096)}
				data, _ := json.Marshal(e)
				kind := "event"
				if i < 192 {
					slot := (int(sequence-1)*192 + i) % 65536
					id = fmt.Sprintf("connection-%d", slot)
					f := model.Flow{ID: id, DeviceID: fmt.Sprintf("device-%d", slot%4096), SourceIP: "192.0.2.10", DestinationIP: "203.0.113.10", SourcePort: 12345, DestinationPort: 443, Protocol: "TCP", BytesSent: uint64(sequence), BytesReceived: uint64(sequence) * 2, StartedAt: at, LastSeen: when, Verdict: "unknown", SamplingRate: 1, State: "active", Evidence: "Synthetic active fixture"}
					data, _ = json.Marshal(f)
					kind = "flow"
				}
				if i >= 192 && i < 216 {
					f := model.Flow{ID: id, DeviceID: e.DeviceID, SourceIP: "192.0.2.10", DestinationIP: "203.0.113.10", Protocol: "TCP", StartedAt: when.Add(-time.Second), LastSeen: when, Verdict: "unknown", State: "completed", SamplingRate: 1, BytesSent: 100, BytesReceived: 200}
					data, _ = json.Marshal(f)
					kind = "flow"
				}
				if i >= 216 && i < 240 {
					d := model.DNS{ID: id, DeviceID: e.DeviceID, ClientIP: "192.0.2.10", Query: "capacity.fixture.test", Type: "A", Result: "NOERROR", Answers: []string{"203.0.113.10"}, ObservedAt: when, Resolver: "fixture", AnswerRecords: []model.DNSAnswer{{Name: "capacity.fixture.test", Type: "A", Value: "203.0.113.10", TTL: 120}}}
					data, _ = json.Marshal(d)
					kind = "dns"
				}
				if i >= 252 {
					device := (int(sequence)*4 + i - 252) % 4096
					end := when.Truncate(30 * time.Second)
					id = fmt.Sprintf("interval-%d-%d", device, end.Unix())
					v := model.TrafficInterval{ID: id, DeviceID: fmt.Sprintf("device-%d", device), Namespace: "host", ObservationPoint: "conntrack-original", Family: "4", From: end.Add(-30 * time.Second), To: end, BytesSent: 100, BytesReceived: 200, CounterStatus: "measured", SamplingRate: 1}
					data, _ = json.Marshal(v)
					kind = "traffic_interval"
				}
				observed := when
				if kind == "traffic_interval" {
					observed = when.Truncate(30 * time.Second)
				}
				batch.Records = append(batch.Records, model.Record{ID: id, Kind: kind, ObservedAt: observed, Data: data})
			}

			item := queuedBatch{batch: batch, at: time.Now()}
			select {
			case queue <- item:
			case <-producerCtx.Done():
				return
			}
			produced += len(batch.Records)
			if len(queue) > queuePeak {
				queuePeak = len(queue)
			}
			rate := 1000.0
			if elapsed := time.Since(started); elapsed >= time.Duration(duration/2)*time.Second && elapsed < time.Duration(duration/2+10)*time.Second {
				rate = 2000
				burstProduced += len(batch.Records)
			}
			scheduled = scheduled.Add(time.Duration(float64(time.Second) * 256 / rate))
			timer := time.NewTimer(max(0, time.Until(scheduled)))
			select {
			case <-timer.C:
			case <-producerCtx.Done():
				timer.Stop()
				return
			}
		}
	}()
	accepted := 0
	writeLatencies, visibility := []float64{}, []float64{}
	for item := range queue {
		writeStarted := time.Now()
		request, cancel := context.WithTimeout(ctx, 4*time.Second)
		result, err := s.Ingest(request, item.batch, time.Now())
		cancel()
		writeLatencies = append(writeLatencies, time.Since(writeStarted).Seconds())
		visibility = append(visibility, time.Since(item.at).Seconds())
		if err != nil {
			mu.Lock()
			errors = append(errors, "ingest: "+err.Error())
			mu.Unlock()
			cancelProducer()
			break
		}
		accepted += result.Accepted
	}
	producer.Wait()
	close(stop)
	workers.Wait()
	quantile := func(values []float64, p float64) float64 {
		if len(values) == 0 {
			return 0
		}
		sort.Float64s(values)
		return values[min(len(values)-1, int(float64(len(values))*p))]
	}
	results := map[string]any{"fixture": map[string]int{"devices": 4096, "active_connections": 65536, "historical_records": 1000000, "minute_rows": 245760}, "seconds": time.Since(started).Seconds(), "accepted": accepted, "produced": produced, "burst_produced": burstProduced, "peak_queued_batches": queuePeak, "visibility_max_seconds": quantile(visibility, 1), "records_per_second": float64(accepted) / time.Since(started).Seconds(), "ingest_p95_seconds": quantile(writeLatencies, .95), "ingest_max_seconds": quantile(writeLatencies, 1), "query": map[string]any{}, "errors": errors, "scope": "Local SQLite metadata only; no physical router or forwarding tests"}
	queryResults := results["query"].(map[string]any)
	for name, values := range latencies {
		p95 := quantile(values, .95)
		queryResults[name] = map[string]any{"samples": len(values), "p95_seconds": p95, "max_seconds": quantile(values, 1)}
		if p95 >= 2 {
			t.Errorf("%s p95 %g exceeds 2 seconds", name, p95)
		}
	}
	data, _ := json.MarshalIndent(results, "", "  ")
	if err = os.WriteFile(filepath.Join(directory, "qualification.json"), data, 0600); err != nil {
		t.Fatal(err)
	}
	t.Log(string(data))
	if accepted != produced {
		t.Errorf("metadata lost or duplicated: accepted=%d produced=%d", accepted, produced)
	}
	if quantile(visibility, 1) > 90 {
		t.Error("source visibility exceeded 90 seconds")
	}
	if burstProduced < 19000 {
		t.Errorf("burst input below target: %d", burstProduced)
	}
	if len(errors) > 0 {
		t.Errorf("qualification failures: %v", errors)
	}
	if float64(accepted) < float64(duration)*1000*.98 {
		t.Errorf("sustained ingest below target: %d records in %ds", accepted, duration)
	}
}
