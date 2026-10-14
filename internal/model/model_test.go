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

func TestDNSFrozenBindingAndAnswerMetadata(t *testing.T) {
	now := time.Now().UTC()
	query := now.Add(-time.Second)
	expired := query.Add(-time.Second)
	for _, name := range []string{"valid", "expired", "future-query", "zero-query", "under-count-answers", "under-count-records", "omitted-values"} {
		t.Run(name, func(t *testing.T) {
			count := uint16(1)
			d := DNS{ID: "dns", DeviceID: "device", ClientIP: "192.0.2.1", QueryAt: &query, Answers: []string{"203.0.113.1"}, AnswerCount: &count, Binding: &Binding{DeviceID: "device", Address: Address{Address: "192.0.2.1", ValidFrom: query.Add(-time.Minute)}}}
			switch name {
			case "expired":
				d.Binding.ValidUntil = &expired
			case "future-query":
				at := now.Add(time.Second)
				d.QueryAt = &at
			case "zero-query":
				d.QueryAt = &time.Time{}
			case "under-count-answers":
				count = 0
			case "under-count-records":
				d.Answers = nil
				d.AnswerRecords = []DNSAnswer{{Value: "1"}, {Value: "2"}}
			case "omitted-values":
				count = 500
				d.AnswersOmitted = true
			}
			body, _ := json.Marshal(d)
			err := (Record{ID: "dns", Kind: "dns", ObservedAt: now, Data: body}).Validate()
			valid := name == "valid" || name == "omitted-values"
			if (err == nil) != valid {
				t.Fatalf("validation=%v valid=%v", err, valid)
			}
		})
	}
}
