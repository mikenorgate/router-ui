package store

import (
	"context"
	"time"
)

type Summary struct {
	Hour     time.Time `json:"hour"`
	Source   string    `json:"source_id"`
	Device   string    `json:"device_id"`
	Flows    uint64    `json:"flows"`
	Sent     uint64    `json:"bytes_sent"`
	Received uint64    `json:"bytes_received"`
}

func (s *Store) Summaries(ctx context.Context, q Query) ([]Summary, error) {
	from := q.From
	if from.IsZero() {
		from = time.Now().AddDate(0, 0, -int(s.historyDays.Load()))
	}
	to := q.To
	if to.IsZero() {
		to = time.Now()
	}
	rows, err := s.read.QueryContext(ctx, "SELECT hour,source,device,flows,sent,received FROM summaries WHERE hour>=? AND hour<=? AND (?='' OR device=?) ORDER BY hour DESC LIMIT 500", from.Unix(), to.Unix(), q.DeviceID, q.DeviceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []Summary{}
	for rows.Next() {
		var hour int64
		var v Summary
		if err = rows.Scan(&hour, &v.Source, &v.Device, &v.Flows, &v.Sent, &v.Received); err != nil {
			return nil, err
		}
		v.Hour = time.Unix(hour, 0).UTC()
		out = append(out, v)
	}
	return out, rows.Err()
}
func (s *Store) FlowCount(ctx context.Context, from time.Time) (uint64, error) {
	return s.FlowCountRange(ctx, from, time.Now())
}
func (s *Store) FlowCountRange(ctx context.Context, from, to time.Time) (uint64, error) {
	var n uint64
	err := s.read.QueryRowContext(ctx, "SELECT COALESCE(SUM(flows),0) FROM summaries WHERE hour>=? AND hour<=?", from.Truncate(time.Hour).Unix(), to.Truncate(time.Hour).Unix()).Scan(&n)
	return n, err
}
func (s *Store) DeviceCounts(ctx context.Context) (int, int, error) {
	var total, active int
	err := s.read.QueryRowContext(ctx, `SELECT COUNT(*),COALESCE(SUM(CASE WHEN julianday(json_extract(body,'$.last_seen'))>=julianday(?) THEN 1 ELSE 0 END),0) FROM latest WHERE kind='device'`, time.Now().UTC().Add(-5*time.Minute).Format(time.RFC3339Nano)).Scan(&total, &active)
	return total, active, err
}
