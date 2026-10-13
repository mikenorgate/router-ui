//go:build integration

package store

import (
	"encoding/json"
	"fmt"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

func TestPolicyFiltersJoinedEvidenceBeforePagination(t *testing.T) {
	s := snapshotStore(t)
	now := time.Now().UTC()
	yes, no := true, false
	records := make([]model.Record, 0, 1200)
	for i := range 600 {
		rule := model.Policy{ID: fmt.Sprintf("test:r%03d", i), Name: "Ordinary rule", Installed: &yes, CountersScope: "shared", ObservedAt: now, Origin: model.Origin{Producer: "fixture", Revision: "ordinary"}}
		app := model.Application{ID: fmt.Sprintf("test:a%03d", i), RuleID: rule.ID, DeviceID: "test:device", BindingRef: "test:binding", InstallationGeneration: "g1", Installed: &no, CountersScope: "shared", Lifecycle: "active", LifecycleAt: now, ObservedAt: now}
		switch i {
		case 599:
			rule.Name = "Needle target"
			rule.Conditions = "destination service-marker"
			rule.Origin = model.Origin{Producer: "needle-producer", Revision: "literal%_needle", SourceRef: "config/needle"}
			app.Installed, app.Applicable, app.ObservedMatch = &yes, &yes, &yes
			app.CountersScope = "device"
		case 598:
			rule.Origin.Producer = "unknown"
		case 597:
			rule.Origin.Producer = ""
		case 596:
			app.Installed = nil // A parent's installed=true must not replace unknown application evidence.
		}
		for _, item := range []struct {
			kind, id string
			value    any
		}{{"rule", rule.ID, rule}, {"application", app.ID, app}} {
			body, err := json.Marshal(item.value)
			if err != nil {
				t.Fatal(err)
			}
			records = append(records, model.Record{ID: item.id, Kind: item.kind, ObservedAt: now, Data: body})
		}
	}
	chunks, manifest := snapshot(t, 1, "policies", records, now)
	commit(t, s, chunks, manifest, now)
	for _, tc := range []struct {
		name, text, evidence string
		count                int
	}{
		{"inherited name", "Needle target", "", 1},
		{"inherited origin", "needle-producer", "", 1},
		{"inherited condition", "service-marker", "", 1},
		{"literal wildcard", "%_needle", "", 1},
		{"installed application", "", "installed", 1},
		{"applicable application", "", "applicable", 1},
		{"attributed match", "", "observed", 1},
		{"unknown origins", "", "unknown", 2},
		{"combined predicates", "needle-producer", "installed", 1},
		{"combined no match", "needle-producer", "unknown", 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			rows, err := s.PolicyViews(t.Context(), Query{DeviceID: "test:device", Q: tc.text, Evidence: tc.evidence, Limit: 100})
			if err != nil || len(rows) != tc.count {
				t.Fatalf("count=%d want=%d error=%v", len(rows), tc.count, err)
			}
			if tc.count == 1 && rows[0].ApplicationID != "test:a599" {
				t.Fatalf("wrong application %s", rows[0].ApplicationID)
			}
		})
	}
	first, err := s.PolicyViews(t.Context(), Query{DeviceID: "test:device", Limit: 500})
	if err != nil || len(first) != 500 {
		t.Fatalf("first page: %d %v", len(first), err)
	}
	second, err := s.PolicyViews(t.Context(), Query{DeviceID: "test:device", Limit: 500, Offset: 500})
	if err != nil || len(second) != 100 || second[99].ApplicationID != "test:a599" {
		t.Fatalf("second page: %d %v", len(second), err)
	}
	if _, err = s.PolicyViews(t.Context(), Query{Evidence: "invalid"}); err == nil {
		t.Fatal("invalid evidence accepted")
	}
}

func BenchmarkPolicyFilterCapacity(b *testing.B) {
	s := capacityQueryStore(b)
	for _, tc := range []struct {
		name  string
		query Query
	}{
		{"joined_origin", Query{DeviceID: fmt.Sprintf("devices:%064x", 4095), Q: "fixture-revision", Limit: 500}},
		{"installed", Query{Evidence: "installed", Limit: 100, Offset: 500}},
		{"unknown", Query{Evidence: "unknown", Limit: 100}},
		{"combined", Query{DeviceID: fmt.Sprintf("devices:%064x", 4095), Q: "Inherited fixture rule", Evidence: "applicable", Limit: 100}},
	} {
		b.Run(tc.name, func(b *testing.B) {
			b.ReportAllocs()
			for b.Loop() {
				if _, err := s.PolicyViews(b.Context(), tc.query); err != nil {
					b.Fatal(err)
				}
			}
		})
	}
}
