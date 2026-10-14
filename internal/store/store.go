// Package store owns console state and bounded, daily-partitioned observation history.
package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/binary"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
	_ "modernc.org/sqlite"
)

var ErrSequence = errors.New("sequence moved backwards or boot identity reused")
var ErrCapacity = errors.New("observation capacity reached")

type Store struct {
	State                  *sql.DB
	history                *sql.DB
	read                   *sql.DB
	path                   string
	budget                 int64
	rawDays, historyDays   atomic.Int64
	rawLimit, historyLimit int
	mu                     sync.Mutex
}
type Result struct {
	Accepted  int    `json:"accepted"`
	Sampled   int    `json:"sampled"`
	Duplicate bool   `json:"duplicate"`
	Cursor    string `json:"cursor"`
	Sequence  uint64 `json:"sequence"`
}
type Query struct {
	DeviceID, Q                                                  string
	RecordID, Evidence                                           string
	PublicEvents                                                 bool
	PolicyDefinition                                             bool
	PolicyRevision                                               string
	History                                                      bool
	Verdict, Protocol, Family, Translation                       string
	State, EventKind, Severity, RCode, Resolver, Segment, RuleID string
	Limit, Offset                                                int
	From, To                                                     time.Time
}
type Annotation struct {
	Alias string `json:"alias"`
	Note  string `json:"note"`
}
type Stats struct {
	MaxRawDays     int     `json:"max_raw_days"`
	MaxHistoryDays int     `json:"max_history_days"`
	Used           int64   `json:"used_bytes"`
	Budget         int64   `json:"budget_bytes"`
	RawDays        int     `json:"raw_days"`
	HistoryDays    int     `json:"history_days"`
	SamplingRate   float64 `json:"sampling_rate"`
}

func open(path string, budget int64) (*sql.DB, error) {
	// A bounded writer page cache avoids repeated dirty index-page spills during
	// complete policy snapshots. Keep FULL durability and automatic checkpoints.
	// Settings must apply to replacement connections after cancellation too.
	options := url.Values{"_pragma": {
		"journal_mode(WAL)", "busy_timeout(3000)", "synchronous(FULL)",
		"cache_size(-32768)", "foreign_keys(ON)", "auto_vacuum(INCREMENTAL)",
		"wal_autocheckpoint(128)", "journal_size_limit(1048576)",
		fmt.Sprintf("max_page_count(%d)", budget*9/10/4096),
	}}
	uri := (&url.URL{Scheme: "file", Path: path, RawQuery: options.Encode()}).String()
	db, err := sql.Open("sqlite", uri)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(1)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err = db.PingContext(ctx); err != nil {
		db.Close()
		return nil, err
	}
	if err = os.Chmod(path, 0600); err != nil {
		db.Close()
		return nil, err
	}
	return db, nil
}
func Open(stateDir, historyDir string, budget, stateBudget int64, rawDays, historyDays int) (*Store, error) {
	for _, d := range []string{stateDir, historyDir} {
		if err := os.MkdirAll(d, 0700); err != nil {
			return nil, err
		}
	}
	state, err := open(filepath.Join(stateDir, "state.sqlite"), stateBudget)
	if err != nil {
		return nil, err
	}
	path := filepath.Join(historyDir, "history.sqlite")
	history, err := open(path, budget)
	if err != nil {
		state.Close()
		return nil, err
	}
	s := &Store{State: state, history: history, path: path, budget: budget, rawLimit: rawDays, historyLimit: historyDays}
	s.rawDays.Store(int64(rawDays))
	s.historyDays.Store(int64(historyDays))
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	// Additive v1 migrations remain readable by the previous release. Never migrate router-owned databases.
	stateSchema := `CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_version VALUES(1);
 CREATE TABLE IF NOT EXISTS preferences(key TEXT PRIMARY KEY,value INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,user_id TEXT NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL,csrf TEXT NOT NULL,origin TEXT NOT NULL,expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS annotations(device_id TEXT PRIMARY KEY,alias TEXT NOT NULL,note TEXT NOT NULL,updated INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS audits(id INTEGER PRIMARY KEY,time INTEGER NOT NULL,actor TEXT NOT NULL,action TEXT NOT NULL,result TEXT NOT NULL);`
	historySchema := `CREATE TABLE IF NOT EXISTS schema_version(version INTEGER PRIMARY KEY); INSERT OR IGNORE INTO schema_version VALUES(1);
 CREATE TABLE IF NOT EXISTS sources(id TEXT PRIMARY KEY,boot TEXT NOT NULL,seq INTEGER NOT NULL,cursor TEXT NOT NULL,body TEXT NOT NULL,batch_hash TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS boots(source TEXT NOT NULL,boot TEXT NOT NULL,PRIMARY KEY(source,boot));
 CREATE TABLE IF NOT EXISTS latest(kind TEXT NOT NULL,id TEXT NOT NULL,source TEXT NOT NULL,time INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(kind,id,source));
 CREATE INDEX IF NOT EXISTS latest_kind_time ON latest(kind,time DESC);
 CREATE TABLE IF NOT EXISTS partitions(day TEXT PRIMARY KEY,rate REAL NOT NULL DEFAULT 1);
 CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value REAL NOT NULL); INSERT OR IGNORE INTO settings VALUES('sampling_rate',1);
 CREATE TABLE IF NOT EXISTS summaries(hour INTEGER NOT NULL,source TEXT NOT NULL,device TEXT NOT NULL,flows INTEGER NOT NULL,sent INTEGER NOT NULL,received INTEGER NOT NULL,PRIMARY KEY(hour,source,device));
 CREATE TABLE IF NOT EXISTS seen_flows(source TEXT NOT NULL,boot TEXT NOT NULL,id TEXT NOT NULL,time INTEGER NOT NULL,PRIMARY KEY(source,boot,id));
 CREATE INDEX IF NOT EXISTS seen_flows_time ON seen_flows(time);`
	for _, v := range []struct {
		db *sql.DB
		q  string
	}{{state, stateSchema}, {history, historySchema}} {
		if _, err = v.db.ExecContext(ctx, v.q); err != nil {
			s.Close()
			return nil, err
		}
		var version int
		if err = v.db.QueryRowContext(ctx, "SELECT MAX(version) FROM schema_version").Scan(&version); err != nil || version < 1 || v.db == state && version != 1 || v.db == history && version > HistorySchemaVersion {
			s.Close()
			return nil, errors.New("unsupported storage version; restore a compatible console artifact")
		}
	}
	if err = s.migrateSnapshots(ctx); err != nil {
		s.Close()
		return nil, err
	}
	if err = s.migrateActivity(ctx); err != nil {
		s.Close()
		return nil, err
	}
	if err = s.loadRetention(ctx); err != nil {
		s.Close()
		return nil, err
	}
	// WAL readers see the last committed generation while ingestion owns the
	// single writer connection. Apply read-only settings to every connection.
	options := url.Values{"mode": {"ro"}, "_pragma": {"query_only(1)", "busy_timeout(3000)"}}
	uri := (&url.URL{Scheme: "file", Path: path, RawQuery: options.Encode()}).String()
	s.read, err = sql.Open("sqlite", uri)
	if err != nil {
		s.Close()
		return nil, err
	}
	s.read.SetMaxOpenConns(4)
	s.read.SetMaxIdleConns(4)
	if err = s.read.PingContext(ctx); err != nil {
		s.Close()
		return nil, err
	}
	return s, nil
}
func (s *Store) Close() error {
	var readErr error
	if s.read != nil {
		readErr = s.read.Close()
	}
	return errors.Join(readErr, s.State.Close(), s.history.Close())
}
func partition(t time.Time) string { return "records_" + t.UTC().Format("20060102") }
func sampleKey(source, boot, id string) uint32 {
	h := sha256.Sum256([]byte(source + "\x00" + boot + "\x00" + id))
	return binary.BigEndian.Uint32(h[:4]) & 0x7fffffff
}
func (s *Store) Ingest(ctx context.Context, b model.Batch, now time.Time) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Result{Cursor: b.Cursor, Sequence: b.Sequence}
	tx, err := s.history.BeginTx(ctx, nil)
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	encoded, err := json.Marshal(b)
	if err != nil {
		return out, err
	}
	sum := sha256.Sum256(encoded)
	batchHash := fmt.Sprintf("%x", sum)
	var boot, cursor, priorHash string
	var seq uint64
	err = tx.QueryRowContext(ctx, "SELECT boot,seq,cursor,batch_hash FROM sources WHERE id=?", b.SourceID).Scan(&boot, &seq, &cursor, &priorHash)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return out, err
	}
	if err == nil && boot == b.BootID {
		if b.Sequence == seq {
			if priorHash != batchHash {
				return out, ErrSequence
			}
			out.Duplicate = true
			out.Cursor = cursor
			return out, nil
		}
		if b.Sequence < seq {
			return out, ErrSequence
		}
	}
	if err == nil && boot != b.BootID {
		var exists int
		e := tx.QueryRowContext(ctx, "SELECT 1 FROM boots WHERE source=? AND boot=?", b.SourceID, b.BootID).Scan(&exists)
		if e == nil {
			return out, ErrSequence
		}
		if !errors.Is(e, sql.ErrNoRows) {
			return out, e
		}
	}
	var rate float64
	if err = tx.QueryRowContext(ctx, "SELECT value FROM settings WHERE key='sampling_rate'").Scan(&rate); err != nil {
		return out, err
	}
	if boot != b.BootID {
		for _, table := range []string{"traffic_cursors", "active_connections"} {
			if _, err = tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE source=? AND boot!=?", b.SourceID, b.BootID); err != nil {
				return out, err
			}
		}
	}
	activity := false
	for _, r := range b.Records {
		if r.Kind == "traffic_interval" {
			activity = true
			changed, e := ingestInterval(ctx, tx, b.SourceID, b.BootID, r, now)
			if e != nil {
				return out, e
			}
			if changed {
				out.Accepted++
			}
			continue
		}
		if r.Kind == "flow" {
			var f model.Flow
			if e := json.Unmarshal(r.Data, &f); e != nil {
				return out, e
			}
			activity = true
			if f.State == "active" {
				// A later transport batch may replay an older active capture.
				// Completion is immutable even if its detail was sampled out.
				var completed int
				e := tx.QueryRowContext(ctx, "SELECT 1 FROM seen_flows WHERE source=? AND boot=? AND id=?", b.SourceID, b.BootID, r.ID).Scan(&completed)
				if e == nil {
					continue
				}
				if !errors.Is(e, sql.ErrNoRows) {
					return out, e
				}
				if _, err = tx.ExecContext(ctx, `INSERT INTO active_connections VALUES(?,?,?,?,?,?) ON CONFLICT(source,boot,id) DO UPDATE SET time=excluded.time,device=excluded.device,body=excluded.body WHERE excluded.time>=active_connections.time`, b.SourceID, b.BootID, r.ID, r.ObservedAt.UnixNano(), f.DeviceID, string(r.Data)); err != nil {
					return out, err
				}
				out.Accepted++
				continue
			}
			if f.State == "completed" || f.State == "" {
				if _, err = tx.ExecContext(ctx, "DELETE FROM active_connections WHERE source=? AND boot=? AND id=?", b.SourceID, b.BootID, r.ID); err != nil {
					return out, err
				}
			}
		}
		table := partition(r.ObservedAt)
		if _, err = tx.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS `+table+`(source TEXT NOT NULL,boot TEXT NOT NULL,id TEXT NOT NULL,kind TEXT NOT NULL,time INTEGER NOT NULL,device TEXT NOT NULL,hash INTEGER NOT NULL,body TEXT NOT NULL,PRIMARY KEY(source,boot,id,kind,time)); CREATE INDEX IF NOT EXISTS `+table+`_time ON `+table+`(kind,time DESC); CREATE INDEX IF NOT EXISTS `+table+`_device ON `+table+`(kind,device,time DESC); CREATE INDEX IF NOT EXISTS `+table+`_verdict ON `+table+`(kind,json_extract(body,'$.verdict'),time DESC) WHERE kind='flow';`); err != nil {
			return out, err
		}
		if _, err = tx.ExecContext(ctx, "INSERT OR IGNORE INTO partitions(day) VALUES(?)", table); err != nil {
			return out, err
		}
		device := ""
		var data map[string]any
		if err = json.Unmarshal(r.Data, &data); err != nil {
			return out, err
		}
		if d, ok := data["device_id"].(string); ok {
			device = d
		}
		if r.Kind == "device" {
			device = r.ID
		}
		// Completed flow IDs are immutable. Summaries are produced before local storage sampling.
		sourceRate := b.SamplingRate
		if r.Kind == "flow" && data["state"] != "decision" {
			var f model.Flow
			if err = json.Unmarshal(r.Data, &f); err != nil {
				return out, err
			}
			sourceRate = f.SamplingRate
			var exists int
			e := tx.QueryRowContext(ctx, "SELECT 1 FROM seen_flows WHERE source=? AND boot=? AND id=?", b.SourceID, b.BootID, r.ID).Scan(&exists)
			if e == nil {
				continue
			}
			if !errors.Is(e, sql.ErrNoRows) {
				return out, e
			}
			if _, err = tx.ExecContext(ctx, "INSERT INTO seen_flows VALUES(?,?,?,?)", b.SourceID, b.BootID, r.ID, r.ObservedAt.Unix()); err != nil {
				return out, err
			}
			if _, err = tx.ExecContext(ctx, `INSERT INTO summaries VALUES(?,?,?,?,?,?) ON CONFLICT(hour,source,device) DO UPDATE SET flows=flows+1,sent=sent+excluded.sent,received=received+excluded.received`, r.ObservedAt.Unix()/3600*3600, b.SourceID, device, 1, f.BytesSent, f.BytesReceived); err != nil {
				return out, err
			}
		}
		hash := sampleKey(b.SourceID, b.BootID, r.ID)
		effectiveRate := rate
		if r.ObservedAt.Before(now.AddDate(0, 0, -int(s.rawDays.Load()))) && effectiveRate > 1.0/64 {
			effectiveRate = 1.0 / 64
		}
		if (r.Kind == "flow" || r.Kind == "dns") && float64(hash)/float64(1<<31) >= effectiveRate {
			out.Sampled++
			continue
		}
		if r.Kind == "flow" || r.Kind == "dns" {
			data["sampling_rate"] = sourceRate * effectiveRate
			data["source_sampling_rate"] = sourceRate
			data["storage_sampling_rate"] = effectiveRate
			r.Data, err = json.Marshal(data)
			if err != nil {
				return out, err
			}
		}
		changed := true
		if r.Kind == "device" || r.Kind == "policy" || r.Kind == "network" || r.Kind == "rule" || r.Kind == "application" || r.Kind == "appliance" {
			var old string
			e := tx.QueryRowContext(ctx, "SELECT body FROM latest WHERE kind=? AND id=? AND source=?", r.Kind, r.ID, b.SourceID).Scan(&old)
			if e != nil && !errors.Is(e, sql.ErrNoRows) {
				return out, e
			}
			changed = e != nil || semantic(old) != semantic(string(r.Data))
		}
		if changed {
			if _, err = tx.ExecContext(ctx, "INSERT INTO "+table+" VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(source,boot,id,kind,time) DO NOTHING", b.SourceID, b.BootID, r.ID, r.Kind, r.ObservedAt.UnixNano(), device, hash, string(r.Data)); err != nil {
				return out, err
			}
		}
		if r.Kind == "device" || r.Kind == "policy" || r.Kind == "network" || r.Kind == "rule" || r.Kind == "application" || r.Kind == "appliance" {
			if _, err = tx.ExecContext(ctx, `INSERT INTO latest VALUES(?,?,?,?,?) ON CONFLICT(kind,id,source) DO UPDATE SET time=excluded.time,body=excluded.body WHERE excluded.time>=latest.time`, r.Kind, r.ID, b.SourceID, r.ObservedAt.UnixNano(), string(r.Data)); err != nil {
				return out, err
			}
		}
		out.Accepted++
	}
	if activity {
		if err = boundActivity(ctx, tx, now); err != nil {
			return out, err
		}
	}
	var deviceCount int
	if err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM latest WHERE kind='device'").Scan(&deviceCount); err != nil {
		return out, err
	}
	if deviceCount > 4096 {
		return out, ErrCapacity
	}
	var previous model.Source
	var previousBody string
	if e := tx.QueryRowContext(ctx, "SELECT body FROM sources WHERE id=?", b.SourceID).Scan(&previousBody); e == nil {
		if e = json.Unmarshal([]byte(previousBody), &previous); e != nil {
			return out, e
		}
	} else if !errors.Is(e, sql.ErrNoRows) {
		return out, e
	}
	gaps := uint64(0)
	if boot == b.BootID {
		gaps = previous.SequenceGaps
		if seq > 0 && b.Sequence > seq+1 {
			gaps += b.Sequence - seq - 1
		}
	}
	kinds := strings.Join(recordKinds(b.Records), ",")
	if kinds == "" {
		kinds = previous.Kind
	}
	source := model.Source{ID: b.SourceID, Kind: kinds, Status: "current", ObservedAt: previous.ObservedAt, CheckedAt: &now, Coverage: b.Coverage, SamplingRate: b.SamplingRate * rate, LostRecords: b.LostRecords, SequenceGaps: gaps, LastSequence: b.Sequence, BootID: b.BootID}
	if len(b.Records) > 0 {
		source.ObservedAt = b.Records[0].ObservedAt
		for _, r := range b.Records {
			if r.ObservedAt.After(source.ObservedAt) {
				source.ObservedAt = r.ObservedAt
			}
		}
	}
	body, err := json.Marshal(source)
	if err != nil {
		return out, err
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO sources VALUES(?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET boot=excluded.boot,seq=excluded.seq,cursor=excluded.cursor,body=excluded.body,batch_hash=excluded.batch_hash`, b.SourceID, b.BootID, b.Sequence, b.Cursor, string(body), batchHash); err != nil {
		return out, err
	}
	if _, err = tx.ExecContext(ctx, "INSERT OR IGNORE INTO boots VALUES(?,?)", b.SourceID, b.BootID); err != nil {
		return out, err
	}
	if err = tx.Commit(); err != nil {
		return out, err
	}
	return out, nil
}
func recordKinds(rs []model.Record) []string {
	seen := map[string]bool{}
	for _, r := range rs {
		seen[r.Kind] = true
	}
	out := []string{}
	for k := range seen {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}
func (s *Store) tables(ctx context.Context, tx *sql.Tx) ([]string, error) {
	query := s.read.QueryContext
	if tx != nil {
		query = tx.QueryContext
	}
	rows, err := query(ctx, "SELECT day FROM partitions ORDER BY day DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var t string
		if err = rows.Scan(&t); err != nil {
			return nil, err
		}
		if !validPartition(t) {
			return nil, errors.New("invalid partition")
		}
		out = append(out, t)
	}
	return out, rows.Err()
}
func (s *Store) Query(ctx context.Context, kind string, q Query) ([]json.RawMessage, error) {
	if q.Limit <= 0 || q.Limit > 500 {
		q.Limit = 100
	}
	if q.Offset < 0 || q.Offset > 10000 {
		return nil, errors.New("cursor out of bounds")
	}
	if len(q.Q) > 128 {
		return nil, errors.New("query too long")
	}
	out := []json.RawMessage{}
	if !q.History && (kind == "device" || kind == "policy" || kind == "network" || kind == "appliance" || kind == "rule" || kind == "application") {
		rows, err := s.read.QueryContext(ctx, `SELECT body FROM latest WHERE kind=? AND (?='' OR id=?) AND (?='' OR body LIKE ? ESCAPE '\') ORDER BY time DESC LIMIT ? OFFSET ?`, kind, q.DeviceID, q.DeviceID, q.Q, "%"+escape(q.Q)+"%", q.Limit, q.Offset)
		if err != nil {
			return nil, err
		}
		defer rows.Close()
		for rows.Next() {
			var b string
			if err = rows.Scan(&b); err != nil {
				return nil, err
			}
			out = append(out, json.RawMessage(b))
		}
		return out, rows.Err()
	}
	return s.queryHistory(ctx, kind, q)
}

func escape(s string) string {
	return strings.NewReplacer("\\", "\\\\", "%", "\\%", "_", "\\_").Replace(s)
}
func (s *Store) Sources(ctx context.Context, now time.Time) ([]model.Source, error) {
	health, err := s.sourceHealth(ctx)
	if err != nil {
		return nil, err
	}
	rows, err := s.read.QueryContext(ctx, "SELECT body FROM sources ORDER BY id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []model.Source{}
	for rows.Next() {
		var body string
		var v model.Source
		if err = rows.Scan(&body); err != nil {
			return nil, err
		}
		if err = json.Unmarshal([]byte(body), &v); err != nil {
			return nil, err
		}
		if h, ok := health[v.ID]; ok {
			v.Status = h.Status
			v.CheckedAt = h.CheckedAt
			v.Coverage = h.Coverage
			v.ErrorCode = h.ErrorCode
			v.LostRecords = h.LostRecords
			delete(health, v.ID)
		}
		if !v.ObservedAt.IsZero() {
			v.LagSeconds = now.Sub(v.ObservedAt).Seconds()
		}
		if v.Status == "current" && (v.ObservedAt.IsZero() || v.LagSeconds > 90) {
			v.Status = "stale"
		}
		out = append(out, v)
	}
	if err = rows.Err(); err != nil {
		return nil, err
	}
	for _, v := range health {
		if v.Status == "current" {
			v.Status = "missing"
		}
		out = append(out, v)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out, nil
}
func (s *Store) Stats(ctx context.Context) (Stats, error) {
	out := Stats{Budget: s.budget, RawDays: int(s.rawDays.Load()), HistoryDays: int(s.historyDays.Load()), MaxRawDays: s.rawLimit, MaxHistoryDays: s.historyLimit}
	for _, p := range []string{s.path, s.path + "-wal"} {
		f, err := os.Stat(p)
		if err == nil {
			out.Used += f.Size()
		} else if !errors.Is(err, os.ErrNotExist) {
			return out, err
		}
	}
	err := s.read.QueryRowContext(ctx, "SELECT value FROM settings WHERE key='sampling_rate'").Scan(&out.SamplingRate)
	return out, err
}
func (s *Store) Maintenance(ctx context.Context, now time.Time) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if _, err := s.history.ExecContext(ctx, "DELETE FROM staged_snapshots WHERE created<?", now.Add(-5*time.Minute).UnixNano()); err != nil {
		return err
	}
	ts, err := s.tables(ctx, nil)
	if err != nil {
		return err
	}
	stats, err := s.Stats(ctx)
	if err != nil {
		return err
	}
	rate := stats.SamplingRate
	if stats.Used > s.budget*7/10 && rate > 1.0/65536 {
		rate /= 2
	}
	tx, err := s.history.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for _, t := range ts {
		day, err := time.Parse("20060102", strings.TrimPrefix(t, "records_"))
		if err != nil {
			return err
		}
		if day.Before(now.UTC().AddDate(0, 0, -int(s.historyDays.Load())).Truncate(24 * time.Hour)) {
			if _, err = tx.ExecContext(ctx, "DROP TABLE "+t); err != nil {
				return err
			}
			if _, err = tx.ExecContext(ctx, "DELETE FROM partitions WHERE day=?", t); err != nil {
				return err
			}
			continue
		}
		threshold := rate
		if day.Before(now.UTC().AddDate(0, 0, -int(s.rawDays.Load())).Truncate(24*time.Hour)) && threshold > 1.0/64 {
			threshold = 1.0 / 64
		}
		var priorRate float64
		if err = tx.QueryRowContext(ctx, "SELECT rate FROM partitions WHERE day=?", t).Scan(&priorRate); err != nil {
			return err
		}
		if threshold < priorRate {
			if _, err = tx.ExecContext(ctx, "DELETE FROM "+t+" WHERE kind IN ('flow','dns') AND hash>=?", int64(threshold*float64(1<<31))); err != nil {
				return err
			}
			if _, err = tx.ExecContext(ctx, "UPDATE "+t+" SET body=json_set(body,'$.storage_sampling_rate',?,'$.sampling_rate',COALESCE(json_extract(body,'$.source_sampling_rate'),1)*?) WHERE kind IN ('flow','dns')", threshold, threshold); err != nil {
				return err
			}
			if _, err = tx.ExecContext(ctx, "UPDATE partitions SET rate=? WHERE day=?", threshold, t); err != nil {
				return err
			}
		}
	}
	for _, q := range []struct {
		sql  string
		args []any
	}{{"UPDATE settings SET value=? WHERE key='sampling_rate'", []any{rate}}, {"DELETE FROM summaries WHERE hour<?", []any{now.AddDate(0, 0, -int(s.historyDays.Load())).Unix()}}, {"DELETE FROM seen_flows WHERE time<?", []any{now.AddDate(0, 0, -int(s.historyDays.Load())).Unix()}}, {"DELETE FROM latest WHERE time<?", []any{now.AddDate(0, 0, -int(s.historyDays.Load())).UnixNano()}}} {
		if _, err = tx.ExecContext(ctx, q.sql, q.args...); err != nil {
			return err
		}
	}
	if err = maintainActivity(ctx, tx, now, int(s.historyDays.Load())); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	if _, err = s.history.ExecContext(ctx, "PRAGMA wal_checkpoint(TRUNCATE)"); err != nil {
		return err
	}
	_, err = s.history.ExecContext(ctx, "PRAGMA incremental_vacuum(256)")
	return err
}
func (s *Store) Annotation(ctx context.Context, id string) (Annotation, error) {
	var a Annotation
	err := s.State.QueryRowContext(ctx, "SELECT alias,note FROM annotations WHERE device_id=?", id).Scan(&a.Alias, &a.Note)
	if errors.Is(err, sql.ErrNoRows) {
		err = nil
	}
	return a, err
}
func (s *Store) Annotate(ctx context.Context, id string, a Annotation) error {
	if !model.Identifier(id) || len(a.Alias) > 128 || len(a.Note) > 2048 {
		return errors.New("annotation bounds exceeded")
	}
	_, err := s.State.ExecContext(ctx, `INSERT INTO annotations VALUES(?,?,?,?) ON CONFLICT(device_id) DO UPDATE SET alias=excluded.alias,note=excluded.note,updated=excluded.updated`, id, a.Alias, a.Note, time.Now().Unix())
	return err
}
func (s *Store) Audit(ctx context.Context, actor, action, result string) error {
	tx, err := s.State.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "INSERT INTO audits(time,actor,action,result) VALUES(?,?,?,?)", time.Now().Unix(), actor, action, result); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM audits WHERE id<(SELECT COALESCE(MAX(id),0)-10000 FROM audits)"); err != nil {
		return err
	}
	return tx.Commit()
}
