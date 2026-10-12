package model

import (
	"encoding/json"
	"testing"
	"time"
)

func TestBatchRejectsInvalidEvidence(t *testing.T) {
	now := time.Now()
	for _, tc := range []struct {
		name, kind string
		data       any
		rate       float64
	}{
		{"shared counters claim device match", "policy", Policy{ID: "rule", DeviceID: "device", CountersScope: "shared", ObservedMatch: func() *bool { v := true; return &v }()}, 1},
		{"invented verdict", "flow", Flow{ID: "rule", SourceIP: "192.0.2.1", DestinationIP: "203.0.113.1", StartedAt: now, LastSeen: now, Verdict: "probably allowed", SamplingRate: 1}, 1},
		{"unauthorized kind", "shell", map[string]string{}, 1},
		{"invalid sampling rate", "event", Event{ID: "rule", Time: now}, 0},
	} {
		t.Run(tc.name, func(t *testing.T) {
			data, err := json.Marshal(tc.data)
			if err != nil {
				t.Fatal(err)
			}
			b := Batch{Version: 1, SourceID: "test", BootID: "boot", Sequence: 1, SamplingRate: tc.rate, Records: []Record{{ID: "rule", Kind: tc.kind, ObservedAt: now, Data: data}}}
			if err = b.Validate(now, []string{"flow", "policy", "event"}); err == nil {
				t.Fatal("invalid evidence accepted")
			}
		})
	}
}
