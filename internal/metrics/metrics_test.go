package metrics

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strconv"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
)

func TestOldMeasurementIsStaleAfterFreshQuery(t *testing.T) {
	old := time.Now().Add(-time.Hour).Unix()
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start, _ := strconv.ParseInt(r.URL.Query().Get("start"), 10, 64)
		end, _ := strconv.ParseInt(r.URL.Query().Get("end"), 10, 64)
		step, _ := strconv.ParseInt(r.URL.Query().Get("step"), 10, 64)
		value := "42"
		if r.URL.Query().Get("query") == "measurement_time" {
			value = strconv.FormatInt(old, 10)
		}
		values := [][2]any{}
		for when := start; when <= end; when += step {
			values = append(values, [2]any{when, value})
		}
		json.NewEncoder(w).Encode(map[string]any{"status": "success", "data": map[string]any{"result": []any{map[string]any{"values": values}}}})
	}))
	defer endpoint.Close()
	c := New(config.Config{PrometheusURL: endpoint.URL, MetricQueries: map[string]config.MetricQuery{"cpu": {Query: "measurement", TimestampQuery: "measurement_time", Label: "CPU", Unit: "%", Scope: "host"}}})
	m, _ := c.Overview(context.Background(), time.Hour)
	if m[0].Status != "stale" || m[0].ObservedAt == nil || m[0].ObservedAt.Unix() != old {
		t.Fatalf("old measurement presented as current: %+v", m[0])
	}
	entry := c.Catalog["cpu"]
	entry.TimestampQuery = ""
	c.Catalog["cpu"] = entry
	m, _ = c.Overview(context.Background(), time.Hour)
	if m[0].Status != "freshness_unknown" || m[0].ObservedAt != nil {
		t.Fatal("query time invented as observation time")
	}
}

func TestMissingSamplesAreGaps(t *testing.T) {
	endpoint := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("query") != "approved_catalog_query" {
			t.Error("query not from catalog")
		}
		w.Header().Set("Content-Type", "application/json")
		w.Write([]byte(`{"status":"success","data":{"result":[]}}`))
	}))
	defer endpoint.Close()
	c := New(config.Config{PrometheusURL: endpoint.URL, MetricQueries: map[string]config.MetricQuery{"download": {Query: "approved_catalog_query", Label: "WAN download", Unit: "B/s", Scope: "host WAN"}}})
	m, series := c.Overview(context.Background(), time.Hour)
	if len(m) != 1 || m[0].Value != nil || m[0].Status != "missing" {
		t.Fatalf("missing metric invented: %+v", m)
	}
	for _, p := range series[0].Points {
		if p.Value != nil {
			t.Fatal("gap rendered as zero")
		}
	}
}
