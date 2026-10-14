package store

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

var ErrReference = errors.New("invalid observation reference")

type ObservationIdentity struct {
	Ref    string    `json:"ref"`
	Kind   string    `json:"kind"`
	Source string    `json:"source_id"`
	Boot   string    `json:"boot_id"`
	ID     string    `json:"record_id"`
	At     time.Time `json:"recorded_at"`
}
type Observation struct {
	Identity ObservationIdentity `json:"identity"`
	Record   json.RawMessage     `json:"record"`
}
type reference struct {
	Source string `json:"s"`
	Boot   string `json:"b"`
	ID     string `json:"i"`
	Kind   string `json:"k"`
	Time   int64  `json:"t"`
}

func observationRef(source, boot, id, kind string, at int64) string {
	b, _ := json.Marshal(reference{source, boot, id, kind, at})
	return base64.RawURLEncoding.EncodeToString(b)
}
func parseRef(ref string) (reference, error) {
	var v reference
	if len(ref) > 1024 {
		return v, ErrReference
	}
	b, err := base64.RawURLEncoding.Strict().DecodeString(ref)
	if err != nil || json.Unmarshal(b, &v) != nil || !model.Identifier(v.Source) || !model.Identifier(v.Boot) || !model.Identifier(v.ID) || !model.Identifier(v.Kind) || v.Time <= 0 || observationRef(v.Source, v.Boot, v.ID, v.Kind, v.Time) != ref {
		return v, ErrReference
	}
	switch v.Kind {
	case "flow", "dns", "event", "device", "rule", "application", "policy", "network", "appliance":
	default:
		return v, ErrReference
	}
	return v, nil
}
func validPartition(table string) bool {
	if len(table) != 16 || !strings.HasPrefix(table, "records_") {
		return false
	}
	_, err := time.Parse("20060102", table[8:])
	return err == nil
}
func annotateObservation(body, source, boot, id, kind string, at int64) (json.RawMessage, error) {
	var v map[string]any
	if err := json.Unmarshal([]byte(body), &v); err != nil {
		return nil, err
	}
	// Transport identity is authoritative; a producer body cannot impersonate
	// another authorized source or link a different boot's record.
	v["source_id"] = source
	v["observation_ref"] = observationRef(source, boot, id, kind, at)
	if kind == "dns" {
		v["query_name"] = v["query"]
		v["query_type"] = v["type"]
		v["rcode"] = v["result"]
	}
	return json.Marshal(v)
}
func (s *Store) Observation(ctx context.Context, ref string) (Observation, error) {
	v, err := parseRef(ref)
	if err != nil {
		return Observation{}, err
	}
	o := Observation{Identity: ObservationIdentity{Ref: ref, Source: v.Source, Boot: v.Boot, ID: v.ID, Kind: v.Kind, At: time.Unix(0, v.Time).UTC()}}
	tx, err := s.read.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return o, err
	}
	defer tx.Rollback()
	var body string
	if v.Kind == "flow" {
		err = tx.QueryRowContext(ctx, "SELECT body FROM active_connections WHERE source=? AND boot=? AND id=? AND time=? AND time>=?", v.Source, v.Boot, v.ID, v.Time, time.Now().Add(-90*time.Second).UnixNano()).Scan(&body)
		if err == nil {
			o.Record, err = annotateObservation(body, v.Source, v.Boot, v.ID, v.Kind, v.Time)
			return o, err
		}
		if !errors.Is(err, sql.ErrNoRows) {
			return o, err
		}
	}
	table := partition(o.Identity.At)
	var exists string
	if err = tx.QueryRowContext(ctx, "SELECT day FROM partitions WHERE day=?", table).Scan(&exists); err != nil {
		return o, err
	}
	err = tx.QueryRowContext(ctx, "SELECT body FROM "+table+" WHERE source=? AND boot=? AND id=? AND kind=? AND time=?", v.Source, v.Boot, v.ID, v.Kind, v.Time).Scan(&body)
	if err != nil {
		return o, err
	}
	o.Record, err = annotateObservation(body, v.Source, v.Boot, v.ID, v.Kind, v.Time)
	return o, err
}

func (s *Store) queryHistory(ctx context.Context, kind string, q Query) ([]json.RawMessage, error) {
	// Partition catalog and data must be pinned together across retention.
	tx, err := s.read.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	ts, err := s.tables(ctx, tx)
	if err != nil {
		return nil, err
	}
	from, to := q.From, q.To
	if from.IsZero() {
		from = time.Now().AddDate(0, 0, -int(s.historyDays.Load()))
	}
	if to.IsZero() {
		to = time.Now().Add(5 * time.Minute)
	}
	parts, args := []string{}, []any{}
	// Build only requested predicates. Optional (?='' OR column=?) clauses
	// prevent SQLite from seeking a device index at retained-history scale.
	predicates := []string{"time>=?", "time<=?"}
	values := []any{from.UnixNano(), to.UnixNano()}
	equal := func(expression, value string) {
		if value != "" {
			predicates = append(predicates, expression+"=?")
			values = append(values, value)
		}
	}
	equal("device", q.DeviceID)
	equal("json_extract(body,'$.origin.revision')", q.PolicyRevision)
	if q.PolicyDefinition {
		predicates = append(predicates, "COALESCE(json_extract(body,'$.device_id'),'')=''", "COALESCE(json_extract(body,'$.application_id'),'')=''")
	}
	equal("id", q.RecordID)
	equal("json_extract(body,'$.verdict')", q.Verdict)
	equal("UPPER(json_extract(body,'$.protocol'))", q.Protocol)
	equal("CASE WHEN INSTR(json_extract(body,'$.source_ip'),':')>0 THEN '6' ELSE '4' END", q.Family)
	equal("CASE WHEN COALESCE(json_extract(body,'$.translated_source_ip'),'')!='' OR COALESCE(json_extract(body,'$.translated_destination_ip'),'')!='' THEN 'recorded' ELSE 'unrecorded' END", q.Translation)
	equal("COALESCE(json_extract(body,'$.state'),'completed')", q.State)
	equal("json_extract(body,'$.kind')", q.EventKind)
	equal("json_extract(body,'$.severity')", q.Severity)
	equal("json_extract(body,'$.result')", q.RCode)
	equal("json_extract(body,'$.resolver')", q.Resolver)
	equal("json_extract(body,'$.rule_id')", q.RuleID)
	if q.Q != "" {
		expression := "body"
		if q.PublicEvents && kind == "event" {
			expression = `(CASE WHEN LOWER(json_extract(body,'$.kind')) IN ('flow','dns','connection','security','firewall') THEN 'Restricted traffic event; Operator access required' ELSE COALESCE(json_extract(body,'$.title'),'') END)`
		}
		predicates = append(predicates, expression+` LIKE ? ESCAPE '\'`)
		values = append(values, "%"+escape(q.Q)+"%")
	}
	appendPart := func(table string, active bool) {
		selectedTable := table
		if !active {
			index := ""
			if q.DeviceID != "" {
				index = table + "_device"
			} else if kind == "flow" && q.Verdict != "" {
				index = table + "_verdict"
			}
			if index != "" {
				var exists int
				if err := tx.QueryRowContext(ctx, "SELECT 1 FROM sqlite_master WHERE type='index' AND name=?", index).Scan(&exists); err == nil {
					selectedTable += " INDEXED BY " + index
				}
			}
		}

		selection := "SELECT source,boot,id,kind,time,body FROM " + selectedTable + " WHERE kind=? AND "
		parameterizedKind := true
		if kind == "flow" {
			selection = "SELECT source,boot,id,kind,time,body FROM " + selectedTable + " WHERE kind='flow' AND "
			parameterizedKind = false
		}
		if active {
			selection = "SELECT source,boot,id,'flow' AS kind,time,body FROM " + table + " WHERE time>=? AND "
			parameterizedKind = false
		}
		// Each partition contributes only the requested global page prefix.
		parts = append(parts, "SELECT * FROM ("+selection+strings.Join(predicates, " AND ")+" ORDER BY time DESC,source,boot,id LIMIT ?)")
		if parameterizedKind {
			args = append(args, kind)
		}

		if active {
			args = append(args, time.Now().Add(-90*time.Second).UnixNano())
		}
		args = append(args, values...)
		args = append(args, q.Limit+q.Offset)
	}
	for _, table := range ts {
		day, _ := time.Parse("20060102", table[8:])
		if day.After(to) || !day.Add(24*time.Hour).After(from) {
			continue
		}
		if q.State != "active" {
			appendPart(table, false)
		}
	}
	if kind == "flow" && (q.State == "" || q.State == "active") && (q.Verdict == "" || q.Verdict == "unknown") {
		appendPart("active_connections", true)
	}
	out := []json.RawMessage{}
	if len(parts) == 0 {
		return out, nil
	}
	args = append(args, q.Limit, q.Offset)
	rows, err := tx.QueryContext(ctx, "SELECT source,boot,id,kind,time,body FROM ("+strings.Join(parts, " UNION ALL ")+") ORDER BY time DESC,source,boot,id LIMIT ? OFFSET ?", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var source, boot, id, k, body string
		var at int64
		if err = rows.Scan(&source, &boot, &id, &k, &at, &body); err != nil {
			return nil, err
		}
		if k != "flow" && k != "dns" && k != "event" {
			out = append(out, json.RawMessage(body))
			continue
		}
		v, err := annotateObservation(body, source, boot, id, k, at)
		if err != nil {
			return nil, err
		}
		out = append(out, v)
	}
	return out, rows.Err()
}
