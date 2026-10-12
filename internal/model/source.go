package model

import (
	"encoding/json"
	"time"
)

// MarshalJSON preserves the distinction between configured-but-unobserved sources and measured zero loss.
func (s Source) MarshalJSON() ([]byte, error) {
	type alias Source
	v := struct {
		alias
		ObservedAt *time.Time `json:"observed_at"`
		Lost       *uint64    `json:"lost_records"`
		Sequence   *uint64    `json:"last_sequence"`
		Rate       *float64   `json:"sampling_rate"`
		Lag        *float64   `json:"lag_seconds"`
	}{alias: alias(s)}
	if !s.ObservedAt.IsZero() {
		v.ObservedAt = &s.ObservedAt
		v.Lost = &s.LostRecords
		v.Sequence = &s.LastSequence
		v.Rate = &s.SamplingRate
		v.Lag = &s.LagSeconds
	}
	return json.Marshal(v)
}
