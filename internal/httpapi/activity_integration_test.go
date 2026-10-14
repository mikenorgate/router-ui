//go:build integration

package httpapi

import (
	"encoding/json"
	"fmt"
	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func activityAPI(t *testing.T) (*store.Store, func(string) *httptest.ResponseRecorder) {
	t.Helper()
	d := t.TempDir()
	s, err := store.Open(filepath.Join(d, "state"), filepath.Join(d, "history"), 64<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = s.Close() })
	if err = auth.Provision(t.Context(), s, "recovery", "correct-horse-example"); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{Fixture: true, Origins: []string{"http://127.0.0.1:8080"}, SessionHours: 1, WebDir: d}
	handler := New(s, auth.New(s, cfg), cfg, "test").Handler()
	r := httptest.NewRequest("POST", cfg.Origins[0]+"/api/v1/auth/login", strings.NewReader(`{"username":"recovery","password":"correct-horse-example"}`))
	r.Header.Set("Content-Type", "application/json")
	r.Header.Set("Origin", cfg.Origins[0])
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, r)
	if w.Code != 200 {
		t.Fatal(w.Body.String())
	}
	cookie := w.Result().Cookies()[0]
	return s, func(path string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(http.MethodGet, cfg.Origins[0]+path, nil)
		r.AddCookie(cookie)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
}
func activitySnapshot(t *testing.T, s *store.Store, seq uint64, scope string, records []model.Record, at time.Time) {
	t.Helper()
	identity := model.SnapshotIdentity{Version: 2, SourceID: "test", BootID: "boot", Sequence: seq, Scope: scope, Generation: fmt.Sprintf("g%d", seq), ObservedAt: at}
	chunk := model.SnapshotChunk{SnapshotIdentity: identity, Records: records}
	digest, err := model.SnapshotDigest([]model.SnapshotChunk{chunk})
	if err != nil {
		t.Fatal(err)
	}
	if err = s.StageChunk(t.Context(), chunk, at); err != nil {
		t.Fatal(err)
	}
	if _, err = s.CommitSnapshot(t.Context(), model.SnapshotCommit{SnapshotIdentity: identity, Chunks: 1, Records: len(records), Digest: digest, Complete: true, Cursor: fmt.Sprint(seq)}, at); err != nil {
		t.Fatal(err)
	}
}
func TestInvestigationFindsHistoricalV2DefinitionBeforePagination(t *testing.T) {
	s, get := activityAPI(t)
	now := time.Now().UTC()
	yes := true
	for i := range 20 {
		at := now.Add(time.Duration(i-25) * time.Minute)
		revision := fmt.Sprint("revision-", i)
		p := model.Policy{ID: "test:rule", Name: "Recorded default deny", Action: "drop", Scope: "baseline", Installed: &yes, Origin: model.Origin{Producer: "fixture", Revision: revision}, ObservedAt: at, CountersScope: "shared", EntryHooks: []string{"input"}}
		body, _ := json.Marshal(p)
		activitySnapshot(t, s, uint64(i+1), "policies", []model.Record{{Kind: "rule", ID: p.ID, ObservedAt: at, Data: body}}, at)
	}
	f := model.Flow{ID: "decision", State: "decision", SourceIP: "192.0.2.1", DestinationIP: "203.0.113.2", StartedAt: now, LastSeen: now, Verdict: "blocked", DecisionSource: "nft-log", RuleID: "test:rule", PolicyRevision: "revision-0", SamplingRate: 1}
	body, _ := json.Marshal(f)
	b := model.Batch{Version: 1, SourceID: "events", BootID: "boot", Sequence: 1, SamplingRate: 1, Records: []model.Record{{Kind: "flow", ID: f.ID, ObservedAt: now, Data: body}}}
	if _, err := s.Ingest(t.Context(), b, now); err != nil {
		t.Fatal(err)
	}
	rows, err := s.Query(t.Context(), "flow", store.Query{RecordID: f.ID})
	if err != nil || len(rows) != 1 {
		t.Fatal(rows, err)
	}
	var row struct {
		Ref string `json:"observation_ref"`
	}
	_ = json.Unmarshal(rows[0], &row)
	response := get("/api/v1/investigations/" + row.Ref)
	var result struct {
		Path []struct {
			Origin model.Origin `json:"origin"`
			Hooks  []string     `json:"entry_hooks"`
		} `json:"policy_path"`
	}
	if err = json.Unmarshal(response.Body.Bytes(), &result); err != nil || response.Code != 200 || len(result.Path) != 1 || result.Path[0].Origin.Revision != "revision-0" || len(result.Path[0].Hooks) != 1 {
		t.Fatalf("historical provenance missing: %d %s %v", response.Code, response.Body.String(), err)
	}
}
func TestHistoricalDeviceAndNonemptyExports(t *testing.T) {
	s, get := activityAPI(t)
	now := time.Now().UTC()
	d := model.Device{ID: "test:device", Name: "Former device", ObservedAt: now, LastSeen: now, Status: "observed", Addresses: []model.Address{{Address: "192.0.2.1", Family: "4", ValidFrom: now.Add(-time.Hour), Source: "fixture"}}}
	body, _ := json.Marshal(d)
	activitySnapshot(t, s, 1, "devices", []model.Record{{ID: d.ID, Kind: "device", ObservedAt: now, Data: body}}, now)
	activitySnapshot(t, s, 2, "devices", []model.Record{}, now.Add(time.Second))
	f := model.Flow{ID: "flow", DeviceID: d.ID, SourceIP: "192.0.2.1", DestinationIP: "203.0.113.2", StartedAt: now.Add(-time.Minute), LastSeen: now, Verdict: "unknown", SamplingRate: 1}
	dns := model.DNS{ID: "dns", DeviceID: d.ID, Query: "fixture.test", Type: "A", Result: "NOERROR"}
	flowBody, _ := json.Marshal(f)
	dnsBody, _ := json.Marshal(dns)
	if _, err := s.Ingest(t.Context(), model.Batch{Version: 1, SourceID: "activity", BootID: "boot", Sequence: 1, SamplingRate: 1, Records: []model.Record{{ID: f.ID, Kind: "flow", ObservedAt: now, Data: flowBody}, {ID: dns.ID, Kind: "dns", ObservedAt: now, Data: dnsBody}}}, now); err != nil {
		t.Fatal(err)
	}
	for _, kind := range []string{"flows", "dns"} {
		w := get("/api/v1/export?kind=" + kind + "&device_id=test:device")
		var out struct {
			Items []json.RawMessage `json:"items"`
		}
		err := json.Unmarshal(w.Body.Bytes(), &out)
		if err != nil || w.Code != 200 || len(out.Items) != 1 {
			t.Fatalf("empty %s export: %d %s %v", kind, w.Code, w.Body.String(), err)
		}
	}
	if _, err := s.State.Exec("UPDATE sessions SET role='viewer'"); err != nil {
		t.Fatal(err)
	}
	w := get("/api/v1/devices/test:device")
	var out struct {
		Current    bool                        `json:"current_inventory"`
		Device     struct{ ID, Status string } `json:"device"`
		Flows      []json.RawMessage           `json:"flows"`
		Bindings   []model.Address             `json:"bindings"`
		Restricted bool                        `json:"detail_restricted"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &out)
	if err != nil || w.Code != 200 || out.Current || out.Device.ID != d.ID || out.Device.Status != "historical" || len(out.Bindings) == 0 || len(out.Flows) != 0 || !out.Restricted {
		t.Fatalf("historical identity/authorization: %s %v", w.Body.String(), err)
	}
}
func TestBaselineOnlyUnattributedIsUnknown(t *testing.T) {
	s, get := activityAPI(t)
	now := time.Now().UTC()
	v := model.TrafficInterval{ID: "baseline", Namespace: "host", ObservationPoint: "conntrack-original", Family: "4", From: now.Add(-30 * time.Second), To: now, CounterStatus: "baseline", SamplingRate: 1}
	body, _ := json.Marshal(v)
	if _, err := s.Ingest(t.Context(), model.Batch{Version: 1, SourceID: "traffic", BootID: "boot", Sequence: 1, SamplingRate: 1, Records: []model.Record{{ID: v.ID, Kind: "traffic_interval", ObservedAt: now, Data: body}}}, now); err != nil {
		t.Fatal(err)
	}
	w := get("/api/v1/traffic/summary")
	var out struct {
		Unattributed map[string]any            `json:"unattributed"`
		ByPoint      map[string]map[string]any `json:"unattributed_by_point"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &out)
	if err != nil || w.Code != 200 || out.Unattributed["bytes_sent"] != nil || len(out.ByPoint) != 1 {
		t.Fatalf("unknown became zero: %s %v", w.Body.String(), err)
	}
	for _, point := range out.ByPoint {
		if point["bytes_sent"] != nil {
			t.Fatal("point baseline became zero")
		}
	}
}

func TestExposureFreshnessRequiresEveryNetworkSource(t *testing.T) {
	s, get := activityAPI(t)
	now := time.Now().UTC()
	for i, source := range []string{"old", "healthy"} {
		n := model.Network{Listeners: []model.ExposureListener{}, Forwards: []model.ExposureForward{}, Inbound: []model.Policy{}}
		if i == 0 {
			n.Listeners = append(n.Listeners, model.ExposureListener{ID: "socket", Address: "127.0.0.1", Port: 8443, Protocol: "TCP", State: "observed"})
		}
		body, _ := json.Marshal(n)
		identity := model.SnapshotIdentity{Version: 2, SourceID: source, BootID: "boot", Scope: "network", Generation: "g1", Sequence: 1, ObservedAt: now}
		chunk := model.SnapshotChunk{SnapshotIdentity: identity, Records: []model.Record{{Kind: "network", ID: source + ":network", ObservedAt: now, Data: body}}}
		digest, _ := model.SnapshotDigest([]model.SnapshotChunk{chunk})
		if err := s.StageChunk(t.Context(), chunk, now); err != nil {
			t.Fatal(err)
		}
		if _, err := s.CommitSnapshot(t.Context(), model.SnapshotCommit{SnapshotIdentity: identity, Chunks: 1, Records: 1, Digest: digest, Complete: true}, now); err != nil {
			t.Fatal(err)
		}
	}
	if err := s.ReportSourceStatus(t.Context(), model.SourceStatus{Version: 2, SourceID: "old", Scope: "network", Status: "failed", Coverage: "Fixture source unavailable"}, now); err != nil {
		t.Fatal(err)
	}
	w := get("/api/v1/exposure")
	var out struct {
		Listeners []model.ExposureListener `json:"listeners"`
	}
	err := json.Unmarshal(w.Body.Bytes(), &out)
	if err != nil || w.Code != 200 || len(out.Listeners) != 1 || out.Listeners[0].State != "stale" {
		t.Fatalf("healthy source masked stale exposure: %s %v", w.Body.String(), err)
	}
}
