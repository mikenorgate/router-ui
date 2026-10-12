// Package fixture provides explicitly selected, site-neutral development observations.
package fixture

import (
	"context"
	"encoding/json"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
)

func Seed(ctx context.Context, s *store.Store) error {
	sources, err := s.Sources(ctx, time.Now())
	if err != nil {
		return err
	}
	for _, source := range sources {
		if source.ID == "fixture" {
			return nil
		}
	}
	now := time.Now().UTC().Truncate(time.Second)
	expired := now.Add(-10 * time.Minute)
	devices := []model.Device{
		{ID: "lab-server", Name: "Lab server", Segment: "Lab", MAC: "02:00:00:00:00:10", Addresses: []model.Address{{Address: "192.0.2.10", Family: "IPv4", ValidFrom: now.Add(-24 * time.Hour), Source: "fixture-dhcp", Confidence: "lease"}, {Address: "2001:db8:1::10", Family: "IPv6", ValidFrom: now.Add(-12 * time.Hour), Source: "fixture-neighbour", Confidence: "observed"}}, LastSeen: now, ObservedAt: now, Status: "recently_observed", Sources: []string{"fixture"}},
		{ID: "backup-node", Name: "Backup node", Segment: "Services", MAC: "02:00:00:00:00:20", Addresses: []model.Address{{Address: "192.0.2.20", Family: "IPv4", ValidFrom: now.Add(-48 * time.Hour), Source: "fixture-dhcp", Confidence: "lease"}}, LastSeen: now.Add(-3 * time.Hour), ObservedAt: now.Add(-3 * time.Hour), Status: "stale", Sources: []string{"fixture"}},
		{ID: "media-device", Name: "Media device", Segment: "Devices", MAC: "02:00:00:00:00:30", Addresses: []model.Address{{Address: "192.0.2.30", Family: "IPv4", ValidFrom: now.Add(-time.Hour), Source: "fixture-dhcp", Confidence: "lease"}}, LastSeen: now, ObservedAt: now, Status: "recently_observed", Sources: []string{"fixture"}},
	}
	policies := []model.Policy{
		{ID: "baseline-dns", Name: "Router DNS", Action: "allow", Scope: "baseline", Conditions: "UDP/TCP destination port 53 to router resolver", Installed: boolean(true), Applicable: boolean(true), Origin: model.Origin{Producer: "image-builder", PolicyID: "client-dns", Revision: "example-12", SourceRef: "policy/baseline.nft"}, Table: "inet filter", Chain: "forward", Hook: "forward", Order: 10, ObservedAt: now, CountersScope: "shared", Packets: counter(1240), Bytes: counter(104160)},
		{ID: "restricted-egress", DeviceID: "media-device", Name: "Restricted egress", Action: "deny", Scope: "segment", Conditions: "Other IPv4/IPv6 internet destinations", Installed: boolean(true), Applicable: boolean(true), ObservedMatch: boolean(true), Origin: model.Origin{Producer: "policy-adapter", PolicyID: "restricted-egress", Revision: "example-12", SourceRef: "policy/segments.yaml", GroupID: "restricted"}, Table: "inet filter", Chain: "restricted", Hook: "forward", Order: 30, ObservedAt: now, CountersScope: "device", Packets: counter(18), Bytes: counter(1080)},
		{ID: "temporary-service", DeviceID: "lab-server", Name: "Temporary service access", Action: "allow", Scope: "device", Conditions: "TCP destination 198.51.100.8 port 443", Installed: boolean(true), Applicable: boolean(true), Origin: model.Origin{Producer: "dynamic-policy", PolicyID: "service-window", Revision: "example-4", GroupID: "lab"}, Table: "inet filter", Chain: "dynamic", Hook: "forward", Order: 20, ObservedAt: now.Add(-15 * time.Minute), ExpiresAt: &expired, CountersScope: "shared", Packets: counter(240), Bytes: counter(18000)},
		{ID: "unknown-origin", Name: "Unattributed installed rule", Action: "log", Scope: "router", Conditions: "Producer and applicability unavailable", Installed: boolean(true), ObservedAt: now, CountersScope: "unknown"},
	}
	flows := []model.Flow{
		{ID: "flow-backup", DeviceID: "lab-server", SourceIP: "192.0.2.10", DestinationIP: "192.0.2.20", DestinationName: "backup.example", SourcePort: 52432, DestinationPort: 22, Protocol: "TCP", BytesSent: 800000000, BytesReceived: 340000, StartedAt: now.Add(-15 * time.Minute), LastSeen: now, Verdict: "unknown", SamplingRate: 1, Evidence: "Connection metadata; no firewall verdict supplied", SourceID: "fixture"},
		{ID: "flow-blocked", DeviceID: "media-device", SourceIP: "192.0.2.30", DestinationIP: "203.0.113.8", DestinationName: "updates.example", SourcePort: 49152, DestinationPort: 443, Protocol: "TCP", BytesSent: 120, StartedAt: now.Add(-2 * time.Minute), LastSeen: now, Verdict: "blocked", RuleID: "restricted-egress", SamplingRate: 1, Evidence: "Attributed firewall event", SourceID: "fixture"},
		{ID: "flow-v6", DeviceID: "lab-server", SourceIP: "2001:db8:1::10", DestinationIP: "2001:db8:2::8", DestinationName: "registry.example", SourcePort: 52100, DestinationPort: 443, Protocol: "TCP", BytesSent: 16000, BytesReceived: 2200000, StartedAt: now.Add(-10 * time.Minute), LastSeen: now, Verdict: "allowed", SamplingRate: 0.25, Evidence: "Sampled flow with observed policy verdict", RuleID: "temporary-service", SourceID: "fixture"},
	}
	events := []model.Event{
		{ID: "event-expiry", Time: expired, Kind: "policy", Severity: "warning", Title: "Temporary policy lifetime ended", Detail: "Expiry is recorded; removal has not yet been confirmed by a fresh installed snapshot.", DeviceID: "lab-server", RuleID: "temporary-service", SourceID: "fixture"},
		{ID: "event-gap", Time: now.Add(-5 * time.Minute), Kind: "telemetry", Severity: "warning", Title: "Flow source reported a gap", Detail: "Three observations were lost. Traffic totals describe available observations.", SourceID: "fixture"},
	}
	network := model.Network{Interfaces: []map[string]any{{"name": "wan0", "state": "up", "addresses": []string{"198.51.100.2"}, "rx_bytes": 123456789, "tx_bytes": 98765432}, {"name": "lab0", "state": "up", "addresses": []string{"192.0.2.1", "2001:db8:1::1"}}}, Segments: []map[string]any{{"id": "lab", "name": "Lab", "cidr": "192.0.2.0/24"}}, Routes: []map[string]any{{"destination": "0.0.0.0/0", "gateway": "198.51.100.1", "interface": "wan0", "family": "IPv4"}}, CoverageNotes: []string{"Explicit fixture data using documentation addresses.", "Router observations cannot identify physical switch ports or wireless topology."}}
	records := []model.Record{}
	add := func(id, kind string, value any) error {
		b, err := json.Marshal(value)
		if err != nil {
			return err
		}
		records = append(records, model.Record{ID: id, Kind: kind, ObservedAt: now, Data: b})
		return nil
	}
	for _, d := range devices {
		if err := add(d.ID, "device", d); err != nil {
			return err
		}
	}
	for _, p := range policies {
		if err := add(p.ID, "policy", p); err != nil {
			return err
		}
	}
	for _, f := range flows {
		if err := add(f.ID, "flow", f); err != nil {
			return err
		}
	}
	for _, e := range events {
		if err := add(e.ID, "event", e); err != nil {
			return err
		}
	}
	if err := add("network", "network", network); err != nil {
		return err
	}
	_, err = s.Ingest(ctx, model.Batch{Version: 1, SourceID: "fixture", BootID: "fixture-v1", Sequence: 1, SamplingRate: 1, LostRecords: 3, Coverage: "Synthetic development observations, never live router measurements", Records: records}, now)
	return err
}

func boolean(v bool) *bool     { return &v }
func counter(v uint64) *uint64 { return &v }
