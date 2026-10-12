// Package model defines the versioned, secret-free observations accepted from router-owned producers.
package model

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/netip"
	"strings"
	"time"
)

const ContractVersion = 1

type Address struct {
	Address    string     `json:"address"`
	Family     string     `json:"family"`
	ValidFrom  time.Time  `json:"valid_from"`
	ValidUntil *time.Time `json:"valid_until,omitempty"`
	Source     string     `json:"source"`
	Confidence string     `json:"confidence"`
}
type Device struct {
	ID         string    `json:"id"`
	Name       string    `json:"name"`
	Segment    string    `json:"segment"`
	MAC        string    `json:"mac"`
	Addresses  []Address `json:"addresses"`
	LastSeen   time.Time `json:"last_seen"`
	ObservedAt time.Time `json:"observed_at"`
	Status     string    `json:"status"`
	Sources    []string  `json:"sources"`
}
type Flow struct {
	ID                      string    `json:"id"`
	DeviceID                string    `json:"device_id"`
	SourceIP                string    `json:"source_ip"`
	DestinationIP           string    `json:"destination_ip"`
	DestinationName         string    `json:"destination_name"`
	SourcePort              uint16    `json:"source_port"`
	DestinationPort         uint16    `json:"destination_port"`
	Protocol                string    `json:"protocol"`
	BytesSent               uint64    `json:"bytes_sent"`
	BytesReceived           uint64    `json:"bytes_received"`
	StartedAt               time.Time `json:"started_at"`
	LastSeen                time.Time `json:"last_seen"`
	Verdict                 string    `json:"verdict"`
	RuleID                  string    `json:"rule_id"`
	PolicyRevision          string    `json:"policy_revision,omitempty"`
	BindingRef              string    `json:"binding_ref,omitempty"`
	TranslatedSourceIP      string    `json:"translated_source_ip,omitempty"`
	TranslatedDestinationIP string    `json:"translated_destination_ip,omitempty"`
	SamplingRate            float64   `json:"sampling_rate"`
	Evidence                string    `json:"evidence"`
	SourceID                string    `json:"source_id"`
}
type Origin struct {
	Producer  string `json:"producer"`
	PolicyID  string `json:"policy_id"`
	Revision  string `json:"revision"`
	SourceRef string `json:"source_ref"`
	GroupID   string `json:"group_id"`
}
type Policy struct {
	ID            string     `json:"id"`
	DeviceID      string     `json:"device_id,omitempty"`
	Action        string     `json:"action"`
	Scope         string     `json:"scope"`
	Name          string     `json:"name"`
	Conditions    string     `json:"conditions"`
	Installed     *bool      `json:"installed"`
	Applicable    *bool      `json:"applicable"`
	ObservedMatch *bool      `json:"observed_match"`
	Origin        Origin     `json:"origin"`
	Table         string     `json:"table"`
	Chain         string     `json:"chain"`
	Hook          string     `json:"hook"`
	Priority      int        `json:"priority"`
	Order         int        `json:"order"`
	ObservedAt    time.Time  `json:"observed_at"`
	ExpiresAt     *time.Time `json:"expires_at,omitempty"`
	CountersScope string     `json:"counters_scope"`
	Packets       *uint64    `json:"packets"`
	Bytes         *uint64    `json:"bytes"`
}
type Event struct {
	ID       string    `json:"id"`
	Time     time.Time `json:"time"`
	Kind     string    `json:"kind"`
	Severity string    `json:"severity"`
	Title    string    `json:"title"`
	Detail   string    `json:"detail"`
	DeviceID string    `json:"device_id"`
	RuleID   string    `json:"rule_id"`
	SourceID string    `json:"source_id"`
}
type Source struct {
	ID           string    `json:"id"`
	Kind         string    `json:"kind"`
	Status       string    `json:"status"`
	ObservedAt   time.Time `json:"observed_at"`
	LagSeconds   float64   `json:"lag_seconds"`
	Coverage     string    `json:"coverage"`
	SamplingRate float64   `json:"sampling_rate"`
	LostRecords  uint64    `json:"lost_records"`
	LastSequence uint64    `json:"last_sequence"`
	BootID       string    `json:"boot_id"`
	SequenceGaps uint64    `json:"sequence_gaps"`
}
type Network struct {
	Interfaces    []map[string]any `json:"interfaces"`
	Segments      []map[string]any `json:"segments"`
	Routes        []map[string]any `json:"routes"`
	CoverageNotes []string         `json:"coverage_notes"`
}
type DNS struct {
	ID         string    `json:"id"`
	DeviceID   string    `json:"device_id"`
	Query      string    `json:"query"`
	Type       string    `json:"type"`
	Result     string    `json:"result"`
	Answers    []string  `json:"answers"`
	ObservedAt time.Time `json:"observed_at"`
}
type Record struct {
	ID         string          `json:"id"`
	Kind       string          `json:"kind"`
	ObservedAt time.Time       `json:"observed_at"`
	Data       json.RawMessage `json:"data"`
}
type Batch struct {
	Version      int      `json:"version"`
	SourceID     string   `json:"source_id"`
	BootID       string   `json:"boot_id"`
	Sequence     uint64   `json:"sequence"`
	Cursor       string   `json:"cursor"`
	Coverage     string   `json:"coverage"`
	SamplingRate float64  `json:"sampling_rate"`
	LostRecords  uint64   `json:"lost_records"`
	Records      []Record `json:"records"`
}

func Identifier(s string) bool {
	if len(s) < 1 || len(s) > 128 {
		return false
	}
	for _, c := range s {
		letter := c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z'
		digit := c >= '0' && c <= '9'
		if !letter && !digit && !strings.ContainsRune("._:-", c) {
			return false
		}
	}
	return true
}

func (b Batch) Validate(now time.Time, allowed []string) error {
	if b.Version != ContractVersion || !Identifier(b.SourceID) || !Identifier(b.BootID) || b.Sequence == 0 || b.Sequence > 1<<62 {
		return errors.New("invalid version, identity or sequence")
	}
	if len(b.Records) > 256 || len(b.Cursor) > 2048 || len(b.Coverage) > 1024 || b.SamplingRate <= 0 || b.SamplingRate > 1 {
		return errors.New("batch bounds exceeded")
	}
	for _, r := range b.Records {
		if !Identifier(r.ID) || r.ObservedAt.IsZero() || r.ObservedAt.After(now.Add(5*time.Minute)) || r.ObservedAt.Before(now.AddDate(0, 0, -90)) || len(r.Data) > 16384 {
			return errors.New("invalid record bounds or observation time")
		}
		found := false
		for _, k := range allowed {
			if k == r.Kind {
				found = true
			}
		}
		if !found {
			return fmt.Errorf("record kind %q not authorized", r.Kind)
		}
		if err := r.Validate(); err != nil {
			return fmt.Errorf("record %s: %w", r.ID, err)
		}
	}
	return nil
}
func (r Record) Validate() error {
	switch r.Kind {
	case "device":
		var v Device
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || len(v.Name) > 256 || len(v.Addresses) > 128 {
			return errors.New("invalid device")
		}
		for _, a := range v.Addresses {
			if _, err := netip.ParseAddr(a.Address); err != nil {
				return errors.New("invalid address")
			}
			if a.ValidFrom.IsZero() || a.ValidUntil != nil && a.ValidUntil.Before(a.ValidFrom) {
				return errors.New("invalid binding lifetime")
			}
		}
	case "flow":
		var v Flow
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || v.StartedAt.IsZero() || v.LastSeen.Before(v.StartedAt) || v.BytesSent > 1<<62 || v.BytesReceived > 1<<62 {
			return errors.New("invalid flow")
		}
		for _, ip := range []string{v.SourceIP, v.DestinationIP} {
			if _, err := netip.ParseAddr(ip); err != nil {
				return errors.New("invalid flow tuple")
			}
		}
		if v.Verdict != "allowed" && v.Verdict != "blocked" && v.Verdict != "unknown" {
			return errors.New("invalid verdict")
		}
		if v.SamplingRate <= 0 || v.SamplingRate > 1 {
			return errors.New("invalid flow sample rate")
		}
	case "policy":
		var v Policy
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || v.CountersScope != "shared" && v.CountersScope != "device" && v.CountersScope != "unknown" {
			return errors.New("invalid policy")
		}
		if v.ObservedMatch != nil && *v.ObservedMatch && v.CountersScope == "shared" && v.DeviceID != "" {
			return errors.New("shared counters do not prove a device match")
		}
	case "event":
		var v Event
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || v.Time.IsZero() {
			return errors.New("invalid event")
		}
	case "dns":
		var v DNS
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || len(v.Query) > 253 || len(v.Answers) > 64 {
			return errors.New("invalid DNS record")
		}
	case "network":
		var v Network
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if len(v.Interfaces) > 128 || len(v.Segments) > 128 || len(v.Routes) > 512 {
			return errors.New("network snapshot too large")
		}
	default:
		return errors.New("unsupported kind")
	}
	return nil
}
