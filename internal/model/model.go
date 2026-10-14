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
	State                     string    `json:"state,omitempty"`
	ConnectionID              string    `json:"connection_id,omitempty"`
	Namespace                 string    `json:"namespace,omitempty"`
	Zone                      uint16    `json:"zone,omitempty"`
	ObservationPoint          string    `json:"observation_point,omitempty"`
	DecisionSource            string    `json:"decision_source,omitempty"`
	Binding                   *Binding  `json:"binding,omitempty"`
	TranslatedSourcePort      *uint16   `json:"translated_source_port,omitempty"`
	TranslatedDestinationPort *uint16   `json:"translated_destination_port,omitempty"`
	ID                        string    `json:"id"`
	DeviceID                  string    `json:"device_id"`
	SourceIP                  string    `json:"source_ip"`
	DestinationIP             string    `json:"destination_ip"`
	DestinationName           string    `json:"destination_name"`
	SourcePort                uint16    `json:"source_port"`
	DestinationPort           uint16    `json:"destination_port"`
	Protocol                  string    `json:"protocol"`
	BytesSent                 uint64    `json:"bytes_sent"`
	BytesReceived             uint64    `json:"bytes_received"`
	StartedAt                 time.Time `json:"started_at"`
	LastSeen                  time.Time `json:"last_seen"`
	Verdict                   string    `json:"verdict"`
	RuleID                    string    `json:"rule_id"`
	PolicyRevision            string    `json:"policy_revision,omitempty"`
	BindingRef                string    `json:"binding_ref,omitempty"`
	TranslatedSourceIP        string    `json:"translated_source_ip,omitempty"`
	TranslatedDestinationIP   string    `json:"translated_destination_ip,omitempty"`
	SamplingRate              float64   `json:"sampling_rate"`
	Evidence                  string    `json:"evidence"`
	SourceID                  string    `json:"source_id"`
}
type Origin struct {
	Producer  string `json:"producer"`
	PolicyID  string `json:"policy_id"`
	Revision  string `json:"revision"`
	SourceRef string `json:"source_ref"`
	GroupID   string `json:"group_id"`
}
type Policy struct {
	EntryHooks             []string   `json:"entry_hooks,omitempty"`
	RuleID                 string     `json:"rule_id,omitempty"`
	ApplicationID          string     `json:"application_id,omitempty"`
	BindingRef             string     `json:"binding_ref,omitempty"`
	InstallationGeneration string     `json:"installation_generation,omitempty"`
	Lifecycle              string     `json:"lifecycle,omitempty"`
	LifecycleAt            *time.Time `json:"lifecycle_at,omitempty"`
	ID                     string     `json:"id"`
	DeviceID               string     `json:"device_id,omitempty"`
	Action                 string     `json:"action"`
	Scope                  string     `json:"scope"`
	Name                   string     `json:"name"`
	Conditions             string     `json:"conditions"`
	Installed              *bool      `json:"installed"`
	Applicable             *bool      `json:"applicable"`
	ObservedMatch          *bool      `json:"observed_match"`
	Origin                 Origin     `json:"origin"`
	Table                  string     `json:"table"`
	Chain                  string     `json:"chain"`
	Hook                   string     `json:"hook"`
	Priority               int        `json:"priority"`
	Order                  int        `json:"order"`
	ObservedAt             time.Time  `json:"observed_at"`
	ExpiresAt              *time.Time `json:"expires_at,omitempty"`
	CountersScope          string     `json:"counters_scope"`
	Packets                *uint64    `json:"packets"`
	Bytes                  *uint64    `json:"bytes"`
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
	Scope        string     `json:"scope,omitempty"`
	Generation   string     `json:"generation,omitempty"`
	CheckedAt    *time.Time `json:"checked_at,omitempty"`
	ErrorCode    string     `json:"error_code,omitempty"`
	ID           string     `json:"id"`
	Kind         string     `json:"kind"`
	Status       string     `json:"status"`
	ObservedAt   time.Time  `json:"observed_at"`
	LagSeconds   float64    `json:"lag_seconds"`
	Coverage     string     `json:"coverage"`
	SamplingRate float64    `json:"sampling_rate"`
	LostRecords  uint64     `json:"lost_records"`
	LastSequence uint64     `json:"last_sequence"`
	BootID       string     `json:"boot_id"`
	SequenceGaps uint64     `json:"sequence_gaps"`
}
type Network struct {
	Truncated     bool               `json:"truncated,omitempty"`
	Listeners     []ExposureListener `json:"listeners,omitempty"`
	Forwards      []ExposureForward  `json:"forwards,omitempty"`
	Inbound       []Policy           `json:"inbound,omitempty"`
	Interfaces    []map[string]any   `json:"interfaces"`
	Segments      []map[string]any   `json:"segments"`
	Routes        []map[string]any   `json:"routes"`
	CoverageNotes []string           `json:"coverage_notes"`
}
type DNS struct {
	TransactionID  string      `json:"transaction_id,omitempty"`
	AnswerCount    *uint16     `json:"answer_count,omitempty"`
	AnswersOmitted bool        `json:"answers_omitted,omitempty"`
	QueryAt        *time.Time  `json:"query_at,omitempty"`
	ClientIP       string      `json:"client_ip,omitempty"`
	Resolver       string      `json:"resolver,omitempty"`
	LatencyMS      *float64    `json:"latency_ms,omitempty"`
	AnswerRecords  []DNSAnswer `json:"answer_records,omitempty"`
	Binding        *Binding    `json:"binding,omitempty"`
	Evidence       string      `json:"evidence,omitempty"`
	ID             string      `json:"id"`
	DeviceID       string      `json:"device_id"`
	Query          string      `json:"query"`
	Type           string      `json:"type"`
	Result         string      `json:"result"`
	Answers        []string    `json:"answers"`
	ObservedAt     time.Time   `json:"observed_at"`
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
	case "traffic_interval":
		return r.validateInterval()
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
		if v.State == "active" && (v.Verdict != "unknown" || v.DecisionSource != "") {
			return errors.New("active conntrack metadata cannot claim an attributed verdict")
		}
		if v.Binding != nil && (v.Binding.DeviceID != v.DeviceID || v.Binding.Address.Address != v.SourceIP) {
			return errors.New("flow binding does not match its attributed source")
		}
		if !validBinding(v.Binding) || (v.State != "" && v.State != "active" && v.State != "completed" && v.State != "decision") || len(v.Namespace) > 128 || len(v.ObservationPoint) > 128 || len(v.ConnectionID) > 128 || len(v.DecisionSource) > 64 {
			return errors.New("invalid flow evidence")
		}
		for _, ip := range []string{v.TranslatedSourceIP, v.TranslatedDestinationIP} {
			if ip != "" {
				if _, err := netip.ParseAddr(ip); err != nil {
					return errors.New("invalid translated tuple")
				}
			}
		}
	case "policy", "rule":
		var v Policy
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if r.Kind == "rule" && v.DeviceID != "" {
			return errors.New("rule definition cannot name a device")
		}
		if v.ID != r.ID || v.CountersScope != "shared" && v.CountersScope != "device" && v.CountersScope != "unknown" {
			return errors.New("invalid policy")
		}
		if v.ObservedMatch != nil && *v.ObservedMatch && v.CountersScope == "shared" && v.DeviceID != "" {
			return errors.New("shared counters do not prove a device match")
		}
	case "application":
		var v Application
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || !Identifier(v.RuleID) || !Identifier(v.DeviceID) || !Identifier(v.BindingRef) || !Identifier(v.InstallationGeneration) || v.ObservedAt.IsZero() || v.LifecycleAt.IsZero() {
			return errors.New("invalid application references")
		}
		if v.CountersScope != "shared" && v.CountersScope != "device" && v.CountersScope != "unknown" {
			return errors.New("invalid application counter scope")
		}
		if v.ObservedMatch != nil && v.CountersScope != "device" {
			return errors.New("device match requires qualified counters")
		}
		switch v.Lifecycle {
		case "active", "expired_pending_removal", "confirmed_removed", "unknown":
		default:
			return errors.New("invalid policy lifecycle")
		}
	case "appliance":
		var v Appliance
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if v.ID != r.ID || !Identifier(v.BootID) || len(v.ImageVersion) > 128 || v.ObservedAt.IsZero() || len(v.Services) > 128 || len(v.Storage) > 32 {
			return errors.New("invalid appliance observation")
		}
		for _, service := range v.Services {
			if !Identifier(service.Name) || len(service.Status) > 32 {
				return errors.New("invalid service observation")
			}
		}
		for _, disk := range v.Storage {
			if len(disk.Mount) > 256 || disk.AvailableBytes > disk.TotalBytes {
				return errors.New("invalid storage observation")
			}
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
		if v.ID != r.ID || len(v.Query) > 253 || len(v.Answers) > 64 || len(v.AnswerRecords) > 64 || len(v.Resolver) > 128 || !validBinding(v.Binding) || v.LatencyMS != nil && (*v.LatencyMS < 0 || *v.LatencyMS > 300000) {
			return errors.New("invalid DNS record")
		}
		if v.TransactionID != "" && !Identifier(v.TransactionID) || v.AnswerCount != nil && (int(*v.AnswerCount) < max(len(v.AnswerRecords), len(v.Answers)) || int(*v.AnswerCount) > max(len(v.AnswerRecords), len(v.Answers)) && !v.AnswersOmitted) {
			return errors.New("invalid DNS metadata")
		}
		observed := r.ObservedAt
		if v.QueryAt != nil {
			if v.QueryAt.IsZero() || v.QueryAt.After(observed) || observed.Sub(*v.QueryAt) > 5*time.Minute {
				return errors.New("invalid DNS query time")
			}
			observed = *v.QueryAt
		}
		if v.Binding != nil && (v.Binding.DeviceID != v.DeviceID || v.Binding.Address.Address != v.ClientIP || observed.Before(v.Binding.ValidFrom) || v.Binding.ValidUntil != nil && !observed.Before(*v.Binding.ValidUntil)) {
			return errors.New("DNS binding does not cover its query client and time")
		}

		for _, answer := range v.AnswerRecords {
			if len(answer.Name) > 253 || len(answer.Type) > 16 || len(answer.Value) > 1024 {
				return errors.New("invalid DNS answer")
			}
		}
	case "network":
		var v Network
		if err := json.Unmarshal(r.Data, &v); err != nil {
			return err
		}
		if len(v.Interfaces) > 128 || len(v.Segments) > 128 || len(v.Routes) > 512 || len(v.Listeners) > 256 || len(v.Forwards) > 256 || len(v.Inbound) > 256 {
			return errors.New("network snapshot too large")
		}
	default:
		return errors.New("unsupported kind")
	}
	return nil
}
