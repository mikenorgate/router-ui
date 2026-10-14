package httpapi

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"sort"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
)

func activityWindow(r *http.Request) (store.Query, error) {
	q, err := query(r)
	if err != nil {
		return q, err
	}
	now := time.Now().UTC()
	if q.From.IsZero() && q.To.IsZero() {
		q.From, q.To = now.Add(-time.Hour), now
	}
	if q.From.IsZero() || q.To.IsZero() || !q.To.After(q.From) || q.To.Sub(q.From) > 7*24*time.Hour || q.From.Before(now.AddDate(0, 0, -90)) || q.To.After(now.Add(5*time.Minute)) {
		return q, errors.New("choose a window of at most seven days within retained history")
	}
	return q, nil
}

func (a *API) trafficSummary(w http.ResponseWriter, r *http.Request) {
	q, err := activityWindow(r)
	if err != nil {
		problem(w, 400, "invalid_query", err.Error())
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	buckets, size, truncated, err := a.Store.Traffic(ctx, q)
	if err != nil {
		problem(w, 503, "unavailable", "Interval traffic unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Traffic source health unavailable")
		return
	}
	rankings, series, points, gaps := []map[string]any{}, []map[string]any{}, []map[string]any{}, []map[string]any{}
	seriesByKey := map[string]map[string]any{}
	pointSeen := map[string]bool{}
	independentPoints := map[string]bool{}
	unattributedByPoint := map[string]map[string]any{}
	unattributedSent, unattributedReceived := uint64(0), uint64(0)
	unattributedMeasured := false
	sourceRate := 1.0
	for _, b := range buckets {
		pointKey := fmt.Sprintf("%s/%s/%d/%s/%s", b.Source, b.Namespace, b.Zone, b.Point, b.Family)
		independentPoints[fmt.Sprintf("%s/%s/%d/%s", b.Source, b.Namespace, b.Zone, b.Point)] = true
		if !pointSeen[pointKey] {
			points = append(points, map[string]any{"source_id": b.Source, "namespace": b.Namespace, "zone": b.Zone, "observation_point": b.Point, "family": b.Family})
			pointSeen[pointKey] = true
		}
		if b.Rate < sourceRate {
			sourceRate = b.Rate
		}
		if b.Time.IsZero() {
			if b.Device == "" {
				if ^uint64(0)-unattributedSent < b.Sent || ^uint64(0)-unattributedReceived < b.Received {
					problem(w, 503, "overflow", "Traffic totals exceed representable bounds")
					return
				}
				row := map[string]any{"bytes_sent": b.Sent, "bytes_received": b.Received, "accounting_point": pointKey}
				if b.Seconds == 0 {
					row["bytes_sent"], row["bytes_received"] = nil, nil
				} else {
					unattributedMeasured = true
				}
				unattributedByPoint[pointKey] = row
				unattributedSent += b.Sent
				unattributedReceived += b.Received
				continue
			}
			row := map[string]any{"device_id": b.Device, "label": b.Device, "bytes_sent": b.Sent, "bytes_received": b.Received, "evidence": "observed", "accounting_point": pointKey, "source_id": b.Source, "family": b.Family}
			if b.Gaps > 0 {
				row["evidence"] = "partial"
			}
			if b.Seconds == 0 {
				row["bytes_sent"], row["bytes_received"] = nil, nil
			}
			rankings = append(rankings, row)
			continue
		}
		if b.Gaps > 0 && len(gaps) < 128 {
			gaps = append(gaps, map[string]any{"from": b.Time, "to": b.Time.Add(time.Duration(size) * time.Second), "reason": "Partial bucket, baseline, counter reset or incomplete collection at " + pointKey})
		}
		for direction, value := range map[string]uint64{"sent": b.Sent, "received": b.Received} {
			key := pointKey + "/" + direction
			s, ok := seriesByKey[key]
			if !ok {
				s = map[string]any{"id": key, "label": pointKey + " " + direction, "unit": "bytes/s", "points": []map[string]any{}}
				seriesByKey[key] = s
			}
			var measured any = float64(value) / float64(size)
			if b.Seconds == 0 {
				measured = nil
			}
			s["points"] = append(s["points"].([]map[string]any), map[string]any{"time": b.Time, "value": measured})
		}
	}
	keys := []string{}
	for key := range seriesByKey {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	for _, key := range keys {
		s := seriesByKey[key]
		samples := s["points"].([]map[string]any)
		// Missing buckets break the chart rather than joining across an outage.
		filled := []map[string]any{}
		for i, p := range samples {
			at := p["time"].(time.Time)
			if i > 0 {
				previous := samples[i-1]["time"].(time.Time)
				if at.Sub(previous) > time.Duration(size)*time.Second {
					filled = append(filled, map[string]any{"time": previous.Add(time.Duration(size) * time.Second), "value": nil})
					if len(gaps) < 128 {
						gaps = append(gaps, map[string]any{"from": previous.Add(time.Duration(size) * time.Second), "to": at, "reason": "No retained interval observations for " + key})
					}
				}
			}
			filled = append(filled, p)
		}
		s["points"] = filled
		series = append(series, s)
	}
	if q.DeviceID != "" {
		for _, lane := range []struct{ kind, label string }{{"dns", "Retained DNS observations"}, {"decision", "Retained blocked decision observations"}} {
			counts, err := a.Store.ActivityCounts(ctx, q, lane.kind, size)
			if err != nil {
				problem(w, 503, "unavailable", "Device observation timeline unavailable")
				return
			}
			if len(counts) == 0 {
				continue
			}
			samples := []map[string]any{}
			for i, count := range counts {
				if i > 0 && count.Time.Sub(counts[i-1].Time) > time.Duration(size)*time.Second {
					samples = append(samples, map[string]any{"time": counts[i-1].Time.Add(time.Duration(size) * time.Second), "value": nil})
				}
				samples = append(samples, map[string]any{"time": count.Time, "value": count.Count})
			}
			series = append(series, map[string]any{"id": "retained-" + lane.kind, "label": lane.label, "unit": "observations/bucket", "points": samples})
		}
	}
	if len(buckets) == 0 {
		gaps = append(gaps, map[string]any{"from": q.From, "to": q.To, "reason": "No retained interval accounting in this window; absence is not zero traffic"})
	}
	var unattributedSentValue, unattributedReceivedValue, sourceRateValue any
	if len(buckets) > 0 {
		sourceRateValue = sourceRate
		if len(independentPoints) == 1 && unattributedMeasured {
			unattributedSentValue, unattributedReceivedValue = unattributedSent, unattributedReceived
		}
	}
	output(w, 200, map[string]any{"interval": map[string]any{"from": q.From, "to": q.To, "live": q.To.After(time.Now().Add(-90 * time.Second))}, "generated_at": time.Now().UTC(), "accounting": "live-interval", "accounting_points": points, "bucket_seconds": size, "rankings": rankings, "unattributed": map[string]any{"bytes_sent": unattributedSentValue, "bytes_received": unattributedReceivedValue, "note": "Unattributed observations only; not the difference from interface counters. Accounting points remain separate."}, "series": series, "gaps": gaps, "truncated": truncated, "rankings_truncated": truncated, "unattributed_by_point": unattributedByPoint, "sampling": map[string]any{"source_rate": sourceRateValue, "storage_rate": 1, "note": "Byte rollups precede detail sampling. DNS/decision lanes count retained observations, not unsampled totals. Whole minute/hour buckets include window edges. Capacity can shorten retention; no sampled-byte extrapolation or final-flow double counting."}, "sources": sources, "capabilities": a.capabilities()})
}

func (a *API) resolveObservation(w http.ResponseWriter, r *http.Request) (store.Observation, bool) {
	o, err := a.Store.Observation(r.Context(), r.PathValue("ref"))
	if err != nil {
		switch {
		case errors.Is(err, store.ErrReference):
			problem(w, 400, "invalid_reference", "Invalid observation reference")
		case errors.Is(err, sql.ErrNoRows):
			problem(w, 404, "not_retained", "Observation is no longer retained, was sampled, or the active connection changed")
		default:
			problem(w, 503, "unavailable", "Observation unavailable")
		}
		return o, false
	}
	return o, true
}
func (a *API) observation(w http.ResponseWriter, r *http.Request) {
	o, ok := a.resolveObservation(w, r)
	if !ok {
		return
	}
	var record struct {
		DeviceID string `json:"device_id"`
		Evidence string `json:"evidence"`
	}
	if err := json.Unmarshal(o.Record, &record); err != nil {
		problem(w, 503, "unavailable", "Observation invalid")
		return
	}
	links := []map[string]string{}
	if record.DeviceID != "" {
		links = append(links, map[string]string{"rel": "device", "href": "/devices/" + url.PathEscape(record.DeviceID), "label": "Device"})
	}
	if o.Identity.Kind == "flow" {
		links = append(links, map[string]string{"rel": "investigation", "href": "/investigations/" + url.PathEscape(o.Identity.Ref), "label": "Explain recorded access"})
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Sources unavailable")
		return
	}
	output(w, 200, map[string]any{"identity": o.Identity, "record": o.Record, "evidence": record.Evidence, "links": links, "sources": sources})
}
func (a *API) investigation(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 4*time.Second)
	defer cancel()
	r = r.WithContext(ctx)
	o, ok := a.resolveObservation(w, r)
	if !ok {
		return
	}
	if o.Identity.Kind != "flow" {
		problem(w, 400, "unsupported_subject", "Choose a recorded connection or firewall decision")
		return
	}
	var f model.Flow
	if err := json.Unmarshal(o.Record, &f); err != nil {
		problem(w, 503, "unavailable", "Connection evidence invalid")
		return
	}
	limits := []string{"Passive explanation of retained observations; no policy simulation or active connectivity test.", "Conntrack presence, a rule's applicability and shared counters do not establish an observed verdict or application success."}
	unresolved := []string{"Did the application complete successfully?", "Were there unobserved packets, offloaded paths or later policy changes?"}
	var decision any
	if f.DecisionSource == "nft-log" && (f.Verdict == "allowed" || f.Verdict == "blocked") {
		decision = map[string]any{"verdict": f.Verdict, "evidence": f.Evidence, "observed_at": o.Identity.At, "observation_ref": o.Identity.Ref}
	} else {
		unresolved = append(unresolved, "No directly observed firewall decision is retained for this connection.")
	}
	path := []map[string]any{}
	if f.RuleID != "" {
		rules, err := a.Store.Query(r.Context(), "policy", store.Query{History: true, RecordID: f.RuleID, PolicyDefinition: true, PolicyRevision: f.PolicyRevision, To: o.Identity.At, Limit: 1})
		if err != nil {
			problem(w, 503, "unavailable", "Policy history unavailable")
			return
		}
		for _, raw := range rules {
			var p model.Policy
			if err = json.Unmarshal(raw, &p); err != nil {
				problem(w, 503, "unavailable", "Policy history invalid")
				return
			}
			if f.PolicyRevision != "" && p.Origin.Revision != f.PolicyRevision {
				continue
			}
			path = append(path, map[string]any{"step": "Recorded rule context", "rule_id": p.ID, "action": p.Action, "scope": p.Scope, "hook": p.Hook, "entry_hooks": p.EntryHooks, "order": p.Order, "installed": p.Installed, "applicable": nil, "observed_match": nil, "counters_scope": p.CountersScope, "origin": p.Origin, "observed_at": p.ObservedAt})
			break
		}
	}
	if len(path) == 0 {
		limits = append(limits, "The recorded rule has no matching retained provenance/revision. No current policy is substituted for historical evidence.")
	}
	var binding any
	if f.Binding != nil && !f.StartedAt.Before(f.Binding.ValidFrom) && (f.Binding.ValidUntil == nil || f.StartedAt.Before(*f.Binding.ValidUntil)) {
		binding = f.Binding
	} else {
		unresolved = append(unresolved, "A qualified address binding valid at connection start is unavailable.")
	}
	translated := f.TranslatedSourceIP != "" || f.TranslatedDestinationIP != ""
	translation := map[string]any{"recorded": translated, "original": map[string]any{"source_ip": f.SourceIP, "source_port": f.SourcePort, "destination_ip": f.DestinationIP, "destination_port": f.DestinationPort}, "note": "Translation is metadata observed at the named namespace/zone; it does not prove an end-to-end path."}
	if translated {
		translation["translated"] = map[string]any{"source_ip": f.TranslatedSourceIP, "source_port": f.TranslatedSourcePort, "destination_ip": f.TranslatedDestinationIP, "destination_port": f.TranslatedDestinationPort}
	}
	events, err := a.Store.Query(r.Context(), "event", store.Query{DeviceID: f.DeviceID, From: o.Identity.At.Add(-5 * time.Minute), To: o.Identity.At.Add(5 * time.Minute), Limit: 50})
	if err != nil {
		problem(w, 503, "unavailable", "Related events unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Sources unavailable")
		return
	}
	limits = append(limits, "Related events are correlation. Route selection and a complete multi-hook rule path were not recorded.")
	output(w, 200, map[string]any{"identity": o.Identity, "subject": map[string]any{"source": f.SourceIP, "destination": f.DestinationIP, "destination_port": f.DestinationPort, "protocol": f.Protocol, "device_id": f.DeviceID, "queried_at": time.Now().UTC()}, "observed_decision": decision, "policy_path": path, "binding": binding, "translation": translation, "unresolved_questions": unresolved, "limits": limits, "sources": sources, "events": events})
}
func (a *API) exposure(w http.ResponseWriter, r *http.Request) {
	n, observed, err := a.networkObservations(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Exposure observation unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Exposure source health unavailable")
		return
	}
	current, found := true, false
	for _, s := range sources {
		if s.Scope == "network" {
			found = true
			current = current && s.Status == "current"
		}
	}
	current = current && found
	if !current {
		for i := range n.Listeners {
			n.Listeners[i].State = "stale"
		}
		for i := range n.Forwards {
			n.Forwards[i].State = "stale"
		}
	}
	notes := append([]string{"Configured exposure is not verified external reachability. Listening sockets do not prove firewall admission. No external scan or probe runs."}, n.CoverageNotes...)
	if !observed {
		notes = append(notes, "No router-owned exposure snapshot has been received.")
	}
	output(w, 200, map[string]any{"generated_at": time.Now().UTC(), "verified_externally": "never", "truncated": n.Truncated, "listeners": n.Listeners, "forwards": n.Forwards, "inbound": n.Inbound, "notes": notes, "sources": sources, "capabilities": a.capabilities()})
}

func (a *API) networkObservations(ctx context.Context) (model.Network, bool, error) {
	items, err := a.Store.Query(ctx, "network", store.Query{Limit: 500})
	n := model.Network{Interfaces: []map[string]any{}, Segments: []map[string]any{}, Routes: []map[string]any{}, Listeners: []model.ExposureListener{}, Forwards: []model.ExposureForward{}, Inbound: []model.Policy{}, CoverageNotes: []string{}}
	if err != nil {
		return n, false, err
	}
	notes := map[string]bool{}
	if len(items) == 500 {
		n.Truncated = true
		n.CoverageNotes = append(n.CoverageNotes, "Network merge reached the 500-record bound; exposure may be incomplete.")
	}
	for _, raw := range items {
		var part model.Network
		if err = json.Unmarshal(raw, &part); err != nil {
			return n, false, err
		}
		n.Interfaces = append(n.Interfaces, part.Interfaces...)
		n.Segments = append(n.Segments, part.Segments...)
		n.Routes = append(n.Routes, part.Routes...)
		n.Listeners = append(n.Listeners, part.Listeners...)
		n.Forwards = append(n.Forwards, part.Forwards...)
		n.Inbound = append(n.Inbound, part.Inbound...)
		for _, note := range part.CoverageNotes {
			if !notes[note] {
				n.CoverageNotes = append(n.CoverageNotes, note)
				notes[note] = true
			}
		}
	}
	return n, len(items) > 0, nil
}
