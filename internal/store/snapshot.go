package store

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

var ErrSnapshot = errors.New("snapshot incomplete, inconsistent or expired")

const HistorySchemaVersion = 2

func (s *Store) migrateSnapshots(ctx context.Context) error {
	_, err := s.history.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS staged_snapshots(source TEXT PRIMARY KEY,identity TEXT NOT NULL,created INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS staged_chunks(source TEXT NOT NULL,idx INTEGER NOT NULL,body BLOB NOT NULL,records INTEGER NOT NULL,PRIMARY KEY(source,idx),FOREIGN KEY(source) REFERENCES staged_snapshots(source) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS scope_members(source TEXT NOT NULL,scope TEXT NOT NULL,kind TEXT NOT NULL,id TEXT NOT NULL,PRIMARY KEY(source,scope,kind,id));
 CREATE TABLE IF NOT EXISTS snapshot_receipts(source TEXT PRIMARY KEY,manifest TEXT NOT NULL,result TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS source_health(source TEXT PRIMARY KEY,body TEXT NOT NULL,checked INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS latest_device_policy ON latest(kind,json_extract(body,'$.device_id'));
 INSERT OR IGNORE INTO schema_version VALUES(2);`)
	return err
}
func (s *Store) StageChunk(ctx context.Context, c model.SnapshotChunk, now time.Time) error {
	body, err := json.Marshal(c)
	if err != nil {
		return err
	}
	return s.StageChunkBytes(ctx, c, body, now)
}

// StageChunkBytes retains the exact wire representation for the manifest digest.
func (s *Store) StageChunkBytes(ctx context.Context, c model.SnapshotChunk, body []byte, now time.Time) error {
	if err := c.Validate(now, model.ScopeKinds(c.Scope)); err != nil {
		return err
	}
	var decoded model.SnapshotChunk
	if err := json.Unmarshal(body, &decoded); err != nil {
		return err
	}
	expected, _ := json.Marshal(c)
	actual, _ := json.Marshal(decoded)
	if !bytes.Equal(expected, actual) {
		return ErrSnapshot
	}
	if len(body) > model.MaxChunkBytes {
		return ErrCapacity
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.history.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "DELETE FROM staged_snapshots WHERE created<?", now.Add(-5*time.Minute).UnixNano()); err != nil {
		return err
	}
	// A committed replay may stage the same chunks again, but cannot change the ACK.
	var boot string
	var seq uint64
	err = tx.QueryRowContext(ctx, "SELECT boot,seq FROM sources WHERE id=?", c.SourceID).Scan(&boot, &seq)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	if err == nil && boot == c.BootID {
		if c.Sequence < seq {
			return ErrSequence
		}
		if c.Sequence == seq {
			return nil
		}
	}
	identity, _ := json.Marshal(c.SnapshotIdentity)
	var prior string
	err = tx.QueryRowContext(ctx, "SELECT identity FROM staged_snapshots WHERE source=?", c.SourceID).Scan(&prior)
	if errors.Is(err, sql.ErrNoRows) {
		_, err = tx.ExecContext(ctx, "INSERT INTO staged_snapshots VALUES(?,?,?)", c.SourceID, string(identity), now.UnixNano())
	} else if err == nil && prior != string(identity) {
		return ErrSnapshot
	}
	if err != nil {
		return err
	}
	var old []byte
	err = tx.QueryRowContext(ctx, "SELECT body FROM staged_chunks WHERE source=? AND idx=?", c.SourceID, c.Index).Scan(&old)
	if err == nil {
		if !bytes.Equal(old, body) {
			return ErrSnapshot
		}
		return tx.Commit()
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return err
	}
	var total, count int
	if err = tx.QueryRowContext(ctx, "SELECT COALESCE(SUM(length(body)),0),COALESCE(SUM(records),0) FROM staged_chunks WHERE source=?", c.SourceID).Scan(&total, &count); err != nil {
		return err
	}
	if total+len(body) > model.MaxSnapshotBytes || count+len(c.Records) > model.MaxSnapshotRecords {
		return ErrCapacity
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO staged_chunks VALUES(?,?,?,?)", c.SourceID, c.Index, body, len(c.Records)); err != nil {
		return err
	}
	return tx.Commit()
}
func (s *Store) CommitSnapshot(ctx context.Context, c model.SnapshotCommit, now time.Time) (Result, error) {
	out := Result{Cursor: c.Cursor, Sequence: c.Sequence}
	if err := c.Validate(now); err != nil {
		return out, err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.history.BeginTx(ctx, nil)
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	manifest, _ := json.Marshal(c)
	var receipt, result string
	err = tx.QueryRowContext(ctx, "SELECT manifest,result FROM snapshot_receipts WHERE source=?", c.SourceID).Scan(&receipt, &result)
	if err == nil && receipt == string(manifest) {
		if err = json.Unmarshal([]byte(result), &out); err != nil {
			return out, err
		}
		out.Duplicate = true
		return out, nil
	}
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return out, err
	}
	var prior model.Source
	var priorBody, boot string
	var seq uint64
	err = tx.QueryRowContext(ctx, "SELECT boot,seq,body FROM sources WHERE id=?", c.SourceID).Scan(&boot, &seq, &priorBody)
	if err == nil {
		if err = json.Unmarshal([]byte(priorBody), &prior); err != nil {
			return out, err
		}
		if prior.Scope != "" && prior.Scope != c.Scope {
			return out, ErrSnapshot
		}
		if boot == c.BootID && c.Sequence <= seq {
			return out, ErrSequence
		}
		if boot != c.BootID {
			var n int
			e := tx.QueryRowContext(ctx, "SELECT 1 FROM boots WHERE source=? AND boot=?", c.SourceID, c.BootID).Scan(&n)
			if e == nil {
				return out, ErrSequence
			}
			if !errors.Is(e, sql.ErrNoRows) {
				return out, e
			}
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return out, err
	}
	identity, _ := json.Marshal(c.SnapshotIdentity)
	var stagedIdentity string
	var created int64
	if err = tx.QueryRowContext(ctx, "SELECT identity,created FROM staged_snapshots WHERE source=?", c.SourceID).Scan(&stagedIdentity, &created); err != nil {
		return out, ErrSnapshot
	}
	if stagedIdentity != string(identity) || now.Sub(time.Unix(0, created)) >= 5*time.Minute {
		return out, ErrSnapshot
	}
	rows, err := tx.QueryContext(ctx, "SELECT idx,body FROM staged_chunks WHERE source=? ORDER BY idx", c.SourceID)
	if err != nil {
		return out, err
	}
	records := []model.Record{}
	hash := sha256.New()
	index := 0
	for rows.Next() {
		var idx int
		var body []byte
		if err = rows.Scan(&idx, &body); err != nil {
			rows.Close()
			return out, err
		}
		if idx != index {
			rows.Close()
			return out, ErrSnapshot
		}
		index++
		_, _ = hash.Write(body)
		_, _ = hash.Write([]byte{'\n'})
		var chunk model.SnapshotChunk
		if err = json.Unmarshal(body, &chunk); err != nil {
			rows.Close()
			return out, err
		}
		records = append(records, chunk.Records...)
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	if index != c.Chunks || len(records) != c.Records || hex.EncodeToString(hash.Sum(nil)) != c.Digest {
		return out, ErrSnapshot
	}
	sort.SliceStable(records, func(i, j int) bool { return records[i].Kind == "rule" && records[j].Kind != "rule" })
	seen := map[string]bool{}
	definitions := map[string]bool{}
	deviceCount := 0
	for _, r := range records {
		if r.Kind == "device" {
			deviceCount++
		}
		if deviceCount > 4096 {
			return out, ErrCapacity
		}
		key := r.Kind + "/" + r.ID
		if seen[key] {
			return out, ErrSnapshot
		}
		seen[key] = true
		if r.Kind == "rule" {
			definitions[r.ID] = true
		}
	}
	for _, r := range records {
		if r.Kind == "application" {
			var a model.Application
			_ = json.Unmarshal(r.Data, &a)
			if !definitions[a.RuleID] {
				return out, ErrSnapshot
			}
		}
	}
	// Only a complete scope can confirm absence. Keep a removal observation in
	// history before deleting the current application; expiry alone never does so.
	rows, err = tx.QueryContext(ctx, `SELECT kind,id,body FROM latest WHERE source=? AND kind IN (SELECT value FROM json_each(?))`, c.SourceID, string(mustJSON(model.ScopeKinds(c.Scope))))
	if err != nil {
		return out, err
	}
	removed := []model.Record{}
	for rows.Next() {
		var kind, id, body string
		if err = rows.Scan(&kind, &id, &body); err != nil {
			rows.Close()
			return out, err
		}
		if !seen[kind+"/"+id] {
			var data map[string]any
			if err = json.Unmarshal([]byte(body), &data); err != nil {
				rows.Close()
				return out, err
			}
			if kind == "application" {
				var a model.Application
				_ = json.Unmarshal([]byte(body), &a)
				var definition string
				if err = tx.QueryRowContext(ctx, "SELECT body FROM latest WHERE kind='rule' AND source=? AND id=?", c.SourceID, a.RuleID).Scan(&definition); err != nil {
					rows.Close()
					return out, err
				}
				var d any
				_ = json.Unmarshal([]byte(definition), &d)
				data["rule_definition"] = d
			}
			data["observed_at"] = c.ObservedAt
			if kind == "application" {
				data["lifecycle"] = "confirmed_removed"
				data["lifecycle_at"] = c.ObservedAt
				data["installed"] = false
				data["observed_match"] = nil
				data["installation_generation"] = c.Generation
			}
			if kind == "device" {
				data["status"] = "not_observed"
			}
			b, _ := json.Marshal(data)
			removed = append(removed, model.Record{ID: id, Kind: kind, ObservedAt: c.ObservedAt, Data: b})
		}
	}
	err = rows.Err()
	rows.Close()
	if err != nil {
		return out, err
	}
	for _, r := range removed {
		if err = s.writeSnapshotHistory(ctx, tx, c, r, true); err != nil {
			return out, err
		}
		if _, err = tx.ExecContext(ctx, "DELETE FROM latest WHERE kind=? AND id=? AND source=?", r.Kind, r.ID, c.SourceID); err != nil {
			return out, err
		}
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM scope_members WHERE source=? AND scope=?", c.SourceID, c.Scope); err != nil {
		return out, err
	}
	for _, r := range records {
		var old string
		e := tx.QueryRowContext(ctx, "SELECT body FROM latest WHERE kind=? AND id=? AND source=?", r.Kind, r.ID, c.SourceID).Scan(&old)
		if e != nil && !errors.Is(e, sql.ErrNoRows) {
			return out, e
		}
		changed := e != nil || semantic(old) != semantic(string(r.Data))
		if changed {
			if err = s.writeSnapshotHistory(ctx, tx, c, r, false); err != nil {
				return out, err
			}
		}
		if _, err = tx.ExecContext(ctx, `INSERT INTO latest VALUES(?,?,?,?,?) ON CONFLICT(kind,id,source) DO UPDATE SET time=excluded.time,body=excluded.body`, r.Kind, r.ID, c.SourceID, r.ObservedAt.UnixNano(), string(r.Data)); err != nil {
			return out, err
		}
		if _, err = tx.ExecContext(ctx, "INSERT INTO scope_members VALUES(?,?,?,?)", c.SourceID, c.Scope, r.Kind, r.ID); err != nil {
			return out, err
		}
		out.Accepted++
	}
	var currentDevices int
	if err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM latest WHERE kind='device'").Scan(&currentDevices); err != nil {
		return out, err
	}
	if currentDevices > 4096 {
		return out, ErrCapacity
	}
	gaps := prior.SequenceGaps
	if boot != c.BootID {
		gaps = 0
	} else if seq > 0 && c.Sequence > seq+1 {
		gaps += c.Sequence - seq - 1
	}
	source := model.Source{ID: c.SourceID, Kind: strings.Join(model.ScopeKinds(c.Scope), ","), Scope: c.Scope, Generation: c.Generation, Status: "current", ObservedAt: c.ObservedAt, CheckedAt: &now, Coverage: "Complete scoped snapshot", SamplingRate: 1, LostRecords: prior.LostRecords, SequenceGaps: gaps, LastSequence: c.Sequence, BootID: c.BootID}
	body, _ := json.Marshal(source)
	if _, err = tx.ExecContext(ctx, `INSERT INTO sources VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET boot=excluded.boot,seq=excluded.seq,cursor=excluded.cursor,body=excluded.body,batch_hash=excluded.batch_hash`, c.SourceID, c.BootID, c.Sequence, c.Cursor, string(body), c.Digest); err != nil {
		return out, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT OR IGNORE INTO boots VALUES(?,?)", c.SourceID, c.BootID); err != nil {
		return out, err
	}
	resultBody, _ := json.Marshal(out)
	if _, err = tx.ExecContext(ctx, `INSERT INTO snapshot_receipts VALUES(?,?,?) ON CONFLICT(source) DO UPDATE SET manifest=excluded.manifest,result=excluded.result`, c.SourceID, string(manifest), string(resultBody)); err != nil {
		return out, err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM staged_snapshots WHERE source=?", c.SourceID); err != nil {
		return out, err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM source_health WHERE source=?", c.SourceID); err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// Ignore only volatile measurement metadata. Bindings, lifetimes, policy revisions,
// applicability and lifecycle remain semantic and must create history.
func semantic(body string) string {
	var data map[string]any
	if json.Unmarshal([]byte(body), &data) != nil {
		return body
	}
	for _, key := range []string{"observed_at", "last_seen", "packets", "bytes", "installation_generation", "lifecycle_at"} {
		delete(data, key)
	}
	b, _ := json.Marshal(data)
	return string(b)
}
func (s *Store) writeSnapshotHistory(ctx context.Context, tx *sql.Tx, c model.SnapshotCommit, r model.Record, removed bool) error {
	table := partition(r.ObservedAt)
	_, err := tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS `+table+`(source TEXT NOT NULL,boot TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,time INTEGER NOT NULL,device TEXT NOT NULL,hash INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(source,boot,id,kind,time)); CREATE INDEX IF NOT EXISTS `+table+`_time ON `+table+`(kind,time DESC);`)
	if err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "INSERT OR IGNORE INTO partitions(day) VALUES(?)", table); err != nil {
		return err
	}
	var data map[string]any
	if err = json.Unmarshal(r.Data, &data); err != nil {
		return err
	}
	device, _ := data["device_id"].(string)
	if r.Kind == "device" {
		device = r.ID
	}
	if removed {
		data["snapshot_removed"] = true
	}
	data["snapshot_generation"] = c.Generation
	body, _ := json.Marshal(data)
	kind := r.Kind
	if r.Kind == "rule" {
		var p model.Policy
		_ = json.Unmarshal(r.Data, &p)
		p = flattenRule(p, nil)
		body, _ = json.Marshal(p)
		kind = "policy"
	}
	if r.Kind == "application" {
		var a model.Application
		_ = json.Unmarshal(r.Data, &a)
		var p model.Policy
		if d, ok := data["rule_definition"]; ok {
			b, _ := json.Marshal(d)
			_ = json.Unmarshal(b, &p)
		} else {
			var definition string
			if err = tx.QueryRowContext(ctx, "SELECT body FROM latest WHERE kind='rule' AND source=? AND id=?", c.SourceID, a.RuleID).Scan(&definition); err != nil {
				return err
			}
			if err = json.Unmarshal([]byte(definition), &p); err != nil {
				return err
			}
		}
		p = flattenRule(p, &a)
		body, _ = json.Marshal(p)
		kind = "policy"
	}
	_, err = tx.ExecContext(ctx, "INSERT OR IGNORE INTO "+table+" VALUES(?,?,?,?,?,?,?,?)", c.SourceID, c.BootID, r.ID, kind, r.ObservedAt.UnixNano(), device, 0, string(body))
	return err
}
func (s *Store) ReportSourceStatus(ctx context.Context, status model.SourceStatus, now time.Time) error {
	if err := status.Validate(); err != nil {
		return err
	}
	body, err := json.Marshal(status)
	if err != nil {
		return err
	}
	_, err = s.history.ExecContext(ctx, `INSERT INTO source_health VALUES(?,?,?) ON CONFLICT(source) DO UPDATE SET body=excluded.body,checked=excluded.checked`, status.SourceID, string(body), now.UnixNano())
	return err
}
func (s *Store) sourceHealth(ctx context.Context) (map[string]model.Source, error) {
	rows, err := s.history.QueryContext(ctx, "SELECT body,checked FROM source_health")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := map[string]model.Source{}
	for rows.Next() {
		var body string
		var ns int64
		var v model.SourceStatus
		if err = rows.Scan(&body, &ns); err != nil {
			return nil, err
		}
		if err = json.Unmarshal([]byte(body), &v); err != nil {
			return nil, err
		}
		checked := time.Unix(0, ns)
		out[v.SourceID] = model.Source{ID: v.SourceID, Scope: v.Scope, Kind: strings.Join(model.ScopeKinds(v.Scope), ","), Status: v.Status, CheckedAt: &checked, Coverage: v.Coverage, ErrorCode: v.ErrorCode, LostRecords: v.LostRecords}
	}
	return out, rows.Err()
}
func flattenRule(r model.Policy, a *model.Application) model.Policy {
	r.RuleID = r.ID
	if a == nil {
		r.Applicable = nil
		r.ObservedMatch = nil
		return r
	}
	r.ID = a.ID
	r.ApplicationID = a.ID
	r.RuleID = a.RuleID
	r.DeviceID = a.DeviceID
	r.BindingRef = a.BindingRef
	r.InstallationGeneration = a.InstallationGeneration
	r.Installed = a.Installed
	r.Applicable = a.Applicable
	r.ObservedMatch = a.ObservedMatch
	r.CountersScope = a.CountersScope
	r.Packets = a.Packets
	r.Bytes = a.Bytes
	r.Lifecycle = a.Lifecycle
	r.LifecycleAt = &a.LifecycleAt
	r.ObservedAt = a.ObservedAt
	r.ExpiresAt = a.ExpiresAt
	return r
}

// PolicyViews filters qualified applications before pagination. Global definitions
// from v2 require applications. Legacy global definitions remain visible with
// unknown device applicability for existing v1 producers.
func (s *Store) PolicyViews(ctx context.Context, q Query) ([]model.Policy, error) {
	if q.Limit <= 0 || q.Limit > 500 {
		q.Limit = 100
	}
	if q.Offset < 0 || q.Offset > 10000 {
		return nil, ErrCapacity
	}
	if len(q.Q) > 128 {
		return nil, ErrCapacity
	}
	rows, err := s.history.QueryContext(ctx, `SELECT l.kind,l.body,COALESCE(r.body,'') FROM latest l LEFT JOIN latest r ON l.kind='application' AND r.kind='rule' AND r.source=l.source AND r.id=json_extract(l.body,'$.rule_id')
 WHERE l.kind IN ('policy','rule','application') AND (?='' OR json_extract(l.body,'$.device_id')=? OR (l.kind='policy' AND COALESCE(json_extract(l.body,'$.device_id'),'')='')) AND (?='' OR l.body LIKE ? ESCAPE '\') ORDER BY l.time DESC,l.kind,l.id LIMIT ? OFFSET ?`, q.DeviceID, q.DeviceID, q.Q, "%"+escape(q.Q)+"%", q.Limit, q.Offset)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Policy{}
	for rows.Next() {
		var kind, body, rule string
		if err = rows.Scan(&kind, &body, &rule); err != nil {
			return nil, err
		}
		var p model.Policy
		if kind == "application" {
			var a model.Application
			if err = json.Unmarshal([]byte(body), &a); err != nil {
				return nil, err
			}
			if rule == "" {
				return nil, fmt.Errorf("application references missing rule")
			}
			if err = json.Unmarshal([]byte(rule), &p); err != nil {
				return nil, err
			}
			p = flattenRule(p, &a)
		} else {
			if err = json.Unmarshal([]byte(body), &p); err != nil {
				return nil, err
			}
			if kind == "rule" || q.DeviceID != "" && p.DeviceID == "" {
				p = flattenRule(p, nil)
			}
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func mustJSON(value any) []byte { data, _ := json.Marshal(value); return data }
