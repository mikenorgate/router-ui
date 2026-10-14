package store

import (
	"context"
	"database/sql"
	"errors"
	"strings"
	"time"
)

type ObservationCount struct {
	Time  time.Time `json:"time"`
	Count uint64    `json:"count"`
}

// ActivityCounts counts retained device observations, not unsampled DNS
// requests or packets. Raw-detail sampling can thin these timeline lanes.
func (s *Store) ActivityCounts(ctx context.Context, q Query, kind string, size int) ([]ObservationCount, error) {
	if q.DeviceID == "" || size != 60 && size != 3600 || kind != "dns" && kind != "decision" {
		return nil, errors.New("invalid device observation count scope")
	}
	tx, err := s.read.BeginTx(ctx, &sql.TxOptions{ReadOnly: true})
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()
	tables, err := s.tables(ctx, tx)
	if err != nil {
		return nil, err
	}
	parts, args := []string{}, []any{}
	for _, table := range tables {
		day, _ := time.Parse("20060102", table[8:])
		if day.After(q.To) || !day.Add(24*time.Hour).After(q.From) {
			continue
		}
		selectedTable := table
		var exists int
		err := tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM sqlite_master WHERE type='index' AND name=?", table+"_device").Scan(&exists)
		if err != nil {
			return nil, err
		}
		if exists > 0 {
			selectedTable += " INDEXED BY " + table + "_device"
		}
		condition := "kind='dns'"
		if kind == "decision" {
			condition = "kind='flow' AND json_extract(body,'$.state')='decision' AND json_extract(body,'$.verdict')='blocked' AND json_extract(body,'$.decision_source')='nft-log'"
		}
		parts = append(parts, "SELECT (time/1000000000/?)*? AS bucket,COUNT(*) AS count FROM "+selectedTable+" WHERE "+condition+" AND device=? AND time>=? AND time<=? GROUP BY bucket")
		args = append(args, size, size, q.DeviceID, q.From.UnixNano(), q.To.UnixNano())
	}
	out := []ObservationCount{}
	if len(parts) == 0 {
		return out, nil
	}
	rows, err := tx.QueryContext(ctx, "SELECT bucket,SUM(count) FROM ("+strings.Join(parts, " UNION ALL ")+") GROUP BY bucket ORDER BY bucket LIMIT 2048", args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var at int64
		var v ObservationCount
		if err = rows.Scan(&at, &v.Count); err != nil {
			return nil, err
		}
		v.Time = time.Unix(at, 0).UTC()
		out = append(out, v)
	}
	return out, rows.Err()
}
