//go:build integration

package store

import (
	"context"
	"encoding/json"
	"fmt"
	"github.com/mikenorgate/router-ui/internal/model"
	"testing"
	"time"
)

func TestFlowFiltersApplyBeforePageLimit(t *testing.T) {
	s := testStore(t)
	ids := []string{}
	for i := 0; i < 150; i++ {
		ids = append(ids, fmt.Sprintf("filter-flow-%03d", i))
	}
	batch := flowBatch(t, 1, ids...)
	for i := range batch.Records {
		var f model.Flow
		if err := json.Unmarshal(batch.Records[i].Data, &f); err != nil {
			t.Fatal(err)
		}
		f.Verdict = "allowed"
		f.Protocol = "TCP"
		if i == 0 {
			f.Verdict = "blocked"
			f.SourceIP = "2001:db8::1"
			f.Protocol = "UDP"
		}
		data, err := json.Marshal(f)
		if err != nil {
			t.Fatal(err)
		}
		batch.Records[i].Data = data
		batch.Records[i].ObservedAt = time.Now().Add(time.Duration(i)*time.Millisecond - time.Second)
	}
	if _, err := s.Ingest(context.Background(), batch, time.Now()); err != nil {
		t.Fatal(err)
	}
	items, err := s.Query(context.Background(), "flow", Query{Verdict: "blocked", Family: "6", Protocol: "UDP", Limit: 1})
	if err != nil || len(items) != 1 {
		t.Fatalf("filtered older flow missing: %d %v", len(items), err)
	}
	var flow model.Flow
	if err = json.Unmarshal(items[0], &flow); err != nil {
		t.Fatal(err)
	}
	if flow.ID != ids[0] {
		t.Fatalf("wrong filtered flow: %s", flow.ID)
	}
}
