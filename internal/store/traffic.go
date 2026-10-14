package store

import (
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/mikenorgate/router-ui/internal/model"
)

const maxTrafficMinutes = 262144
const maxTrafficHours = 524288
const maxTrafficCursors = 65536

// With at most 524288 hour rows plus a bounded batch, this per-direction
// bucket cap keeps every retained range and sent+received ordering in int64.
// Reject excessive accounting atomically rather than acknowledge overflow.
const maxTrafficBucketBytes int64 = 1 << 42

func (s *Store) migrateActivity(ctx context.Context) error {
	// Additive tables intentionally leave schema 2 and all positional legacy
	// INSERTs untouched. The previous application can open and maintain this DB.
	_, err := s.history.ExecContext(ctx, `
CREATE TABLE IF NOT EXISTS traffic_cursors(source TEXT NOT NULL,boot TEXT NOT NULL,key TEXT NOT NULL,end INTEGER NOT NULL,hash TEXT NOT NULL,PRIMARY KEY(source,boot,key)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS traffic_cursors_end ON traffic_cursors(end);
CREATE TABLE IF NOT EXISTS active_connections(source TEXT NOT NULL,boot TEXT NOT NULL,id TEXT NOT NULL,time INTEGER NOT NULL,device TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(source,boot,id)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS active_connections_time ON active_connections(time);
CREATE INDEX IF NOT EXISTS active_connections_device ON active_connections(device,time DESC);
CREATE INDEX IF NOT EXISTS active_connections_order ON active_connections(time DESC,source,boot,id);
`)
	if err != nil {
		return err
	}
	for _, table := range []string{"traffic_minutes", "traffic_hours"} {
		_, err = s.history.ExecContext(ctx, `CREATE TABLE IF NOT EXISTS `+table+`(bucket INTEGER NOT NULL,source TEXT NOT NULL,device TEXT NOT NULL,namespace TEXT NOT NULL,zone INTEGER NOT NULL,point TEXT NOT NULL,family TEXT NOT NULL,segment TEXT NOT NULL,sent INTEGER NOT NULL,received INTEGER NOT NULL,connections INTEGER NOT NULL,gaps INTEGER NOT NULL,seconds REAL NOT NULL,rate REAL NOT NULL,PRIMARY KEY(bucket,source,device,namespace,zone,point,family)) WITHOUT ROWID;
CREATE INDEX IF NOT EXISTS `+table+`_device ON `+table+`(device,bucket);
CREATE INDEX IF NOT EXISTS `+table+`_rank ON `+table+`(source,device,namespace,zone,point,family,bucket,sent,received,connections,gaps,seconds,rate);
CREATE INDEX IF NOT EXISTS `+table+`_series ON `+table+`(bucket,source,namespace,zone,point,family,device,sent,received,connections,gaps,seconds,rate);
INSERT OR IGNORE INTO settings(key,value) SELECT '`+table+`_count',COUNT(*) FROM `+table+`;`)
		if err != nil {
			return err
		}
	}
	return nil
}

func ingestInterval(ctx context.Context, tx *sql.Tx, source, boot string, r model.Record, now time.Time) (bool, error) {
	if err := r.Validate(); err != nil {
		return false, err
	}
	var v model.TrafficInterval
	if err := json.Unmarshal(r.Data, &v); err != nil {
		return false, err
	}
	// Cursors, not per-record dedup IDs, bound cardinality independently of the
	// sample rate and retention span. A rolled-back old boot cannot be reused.
	key, _ := json.Marshal([]any{v.DeviceID, v.Namespace, v.Zone, v.ObservationPoint, v.Family})
	hash := fmt.Sprintf("%x", sha256.Sum256(r.Data))
	var end int64
	var priorHash string
	err := tx.QueryRowContext(ctx, "SELECT end,hash FROM traffic_cursors WHERE source=? AND boot=? AND key=?", source, boot, string(key)).Scan(&end, &priorHash)
	if err == nil {
		if v.To.UnixNano() == end && hash != priorHash {
			return false, ErrSequence
		}
		if v.To.UnixNano() <= end {
			return false, nil
		}
		if v.From.UnixNano() < end {
			return false, ErrSequence
		}
	} else if !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}
	// Reject old exports instead of accepting them again after bounded cursor
	// eviction. Producers publish their durable backlog oldest first.
	if v.To.Before(now.Add(-2 * time.Hour)) {
		return false, errors.New("traffic interval is outside the replay window")
	}
	if _, err = tx.ExecContext(ctx, `INSERT INTO traffic_cursors VALUES(?,?,?,?,?) ON CONFLICT(source,boot,key) DO UPDATE SET end=excluded.end,hash=excluded.hash`, source, boot, string(key), v.To.UnixNano(), hash); err != nil {
		return false, err
	}
	gaps, seconds := 0, v.To.Sub(v.From).Seconds()
	if v.Partial {
		gaps = 1
	}
	if v.CounterStatus != "measured" {
		gaps, seconds = 1, 0
	}
	for _, target := range []struct {
		table string
		size  int64
		cap   int
	}{{"traffic_minutes", 60, maxTrafficMinutes}, {"traffic_hours", 3600, maxTrafficHours}} {
		bucket := v.From.Unix() / target.size * target.size
		result, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO `+target.table+` VALUES(?,?,?,?,?,?,?,?,0,0,0,0,0,1)`, bucket, source, v.DeviceID, v.Namespace, v.Zone, v.ObservationPoint, v.Family, v.Segment)
		if err != nil {
			return false, err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return false, err
		}
		if _, err = tx.ExecContext(ctx, `UPDATE settings SET value=value+? WHERE key=?`, n, target.table+"_count"); err != nil {
			return false, err
		}
		result, err = tx.ExecContext(ctx, `UPDATE `+target.table+` SET sent=sent+?,received=received+?,connections=MAX(connections,?),gaps=gaps+?,seconds=seconds+?,rate=MIN(rate,?) WHERE bucket=? AND source=? AND device=? AND namespace=? AND zone=? AND point=? AND family=? AND sent<=? AND received<=?`, v.BytesSent, v.BytesReceived, v.ActiveConnections, gaps, seconds, v.SamplingRate, bucket, source, v.DeviceID, v.Namespace, v.Zone, v.ObservationPoint, v.Family, maxTrafficBucketBytes-int64(v.BytesSent), maxTrafficBucketBytes-int64(v.BytesReceived))
		if err != nil {
			return false, err
		}
		n, err = result.RowsAffected()
		if err != nil {
			return false, err
		}
		if n != 1 {
			return false, ErrCapacity
		}
	}
	return true, nil
}

func boundActivity(ctx context.Context, tx *sql.Tx, now time.Time) error {
	for _, target := range []struct {
		table string
		cap   int
	}{{"traffic_minutes", maxTrafficMinutes}, {"traffic_hours", maxTrafficHours}} {
		var count int
		if err := tx.QueryRowContext(ctx, "SELECT value FROM settings WHERE key=?", target.table+"_count").Scan(&count); err != nil {
			return err
		}
		if count > target.cap {
			result, err := tx.ExecContext(ctx, `DELETE FROM `+target.table+` WHERE (bucket,source,device,namespace,zone,point,family) IN (SELECT bucket,source,device,namespace,zone,point,family FROM `+target.table+` ORDER BY bucket LIMIT ?)`, count-target.cap+1024)
			if err != nil {
				return err
			}
			n, err := result.RowsAffected()
			if err != nil {
				return err
			}
			if _, err = tx.ExecContext(ctx, "UPDATE settings SET value=value-? WHERE key=?", n, target.table+"_count"); err != nil {
				return err
			}
		}
	}
	// An aged key is safe to evict only after the accepted replay window ends.
	if _, err := tx.ExecContext(ctx, "DELETE FROM traffic_cursors WHERE end<?", now.Add(-2*time.Hour).UnixNano()); err != nil {
		return err
	}
	var count int
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM traffic_cursors").Scan(&count); err != nil {
		return err
	}
	if count > maxTrafficCursors {
		return ErrCapacity
	}
	if _, err := tx.ExecContext(ctx, "DELETE FROM active_connections WHERE time<?", now.Add(-90*time.Second).UnixNano()); err != nil {
		return err
	}
	if err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM active_connections").Scan(&count); err != nil {
		return err
	}
	if count > 65536 {
		return ErrCapacity
	}
	return nil
}

func maintainActivity(ctx context.Context, tx *sql.Tx, now time.Time, historyDays int) error {
	for table, cutoff := range map[string]int64{"traffic_minutes": now.Add(-24 * time.Hour).Unix(), "traffic_hours": now.AddDate(0, 0, -historyDays).Unix()} {
		result, err := tx.ExecContext(ctx, "DELETE FROM "+table+" WHERE bucket<?", cutoff)
		if err != nil {
			return err
		}
		n, err := result.RowsAffected()
		if err != nil {
			return err
		}
		if _, err = tx.ExecContext(ctx, "UPDATE settings SET value=value-? WHERE key=?", n, table+"_count"); err != nil {
			return err
		}
	}
	return boundActivity(ctx, tx, now)
}

type TrafficBucket struct {
	Time        time.Time `json:"time"`
	Source      string    `json:"source_id"`
	Device      string    `json:"device_id"`
	Namespace   string    `json:"namespace"`
	Zone        uint16    `json:"zone"`
	Point       string    `json:"observation_point"`
	Family      string    `json:"family"`
	Sent        uint64    `json:"bytes_sent"`
	Received    uint64    `json:"bytes_received"`
	Connections uint32    `json:"active_connections"`
	Gaps        int       `json:"gaps"`
	Seconds     float64   `json:"measured_seconds"`
	Rate        float64   `json:"source_sampling_rate"`
}

// Traffic reads a fixed maximum number of aggregate rows. The HTTP layer
// reports truncation rather than passing a partial ranking off as a total.
func (s *Store) Traffic(ctx context.Context, q Query) ([]TrafficBucket, int, bool, error) {
	table, size := "traffic_hours", 3600
	if q.To.Sub(q.From) <= 24*time.Hour && !q.From.Before(time.Now().Add(-24*time.Hour)) {
		table, size = "traffic_minutes", 60
	}
	tx, err := s.read.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, size, false, err
	}
	defer tx.Rollback()
	out := []TrafficBucket{}
	truncated := false
	for _, timeline := range []bool{false, true} {
		selection, group, ordering := "-1,source,device,namespace,zone,point,family", "source,device,namespace,zone,point,family", "SUM(sent)+SUM(received) DESC"
		if timeline {
			selection, group, ordering = "bucket,source,'',namespace,zone,point,family", "bucket,source,namespace,zone,point,family", "bucket"
		}
		index := table + "_rank"
		if timeline {
			index = table + "_series"
		}
		if q.DeviceID != "" {
			index = table + "_device"
		}
		predicates := []string{"bucket>=?", "bucket<?"}
		args := []any{q.From.Unix() / int64(size) * int64(size), q.To.Unix()}
		for _, filter := range []struct{ column, value string }{{"device", q.DeviceID}, {"family", q.Family}, {"segment", q.Segment}} {
			if filter.value != "" {
				predicates = append(predicates, filter.column+"=?")
				args = append(args, filter.value)
			}
		}
		rows, err := tx.QueryContext(ctx, `SELECT `+selection+`,SUM(sent),SUM(received),MAX(connections),SUM(gaps)+MAX(CASE WHEN gaps=0 AND seconds<`+fmt.Sprint(size)+` THEN 1 ELSE 0 END),SUM(seconds),MIN(rate) FROM `+table+` INDEXED BY `+index+` WHERE `+strings.Join(predicates, " AND ")+` GROUP BY `+group+` ORDER BY `+ordering+` LIMIT 32769`, args...)

		if err != nil {
			return nil, size, false, err
		}
		count := 0
		for rows.Next() {
			var v TrafficBucket
			var timestamp int64
			if err = rows.Scan(&timestamp, &v.Source, &v.Device, &v.Namespace, &v.Zone, &v.Point, &v.Family, &v.Sent, &v.Received, &v.Connections, &v.Gaps, &v.Seconds, &v.Rate); err != nil {
				rows.Close()
				return nil, size, false, err
			}
			count++
			if count > 32768 {
				truncated = true
				break
			}
			if timestamp >= 0 {
				v.Time = time.Unix(timestamp, 0).UTC()
			}
			out = append(out, v)
		}
		err = rows.Err()
		rows.Close()
		if err != nil {
			return nil, size, false, err
		}
	}
	return out, size, truncated, nil
}
