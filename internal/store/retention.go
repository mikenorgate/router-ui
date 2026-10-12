package store

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

var ErrRetention = errors.New("retention exceeds installation limits or history is shorter than raw detail")

func (s *Store) loadRetention(ctx context.Context) error {
	raw, history := s.rawLimit, s.historyLimit
	for key, target := range map[string]*int{"raw_days": &raw, "history_days": &history} {
		err := s.State.QueryRowContext(ctx, "SELECT value FROM preferences WHERE key=?", key).Scan(target)
		if err != nil && !errors.Is(err, sql.ErrNoRows) {
			return err
		}
	}
	if raw < 1 || raw > s.rawLimit {
		raw = s.rawLimit
	}
	if history < raw || history > s.historyLimit {
		history = s.historyLimit
	}
	s.rawDays.Store(int64(raw))
	s.historyDays.Store(int64(history))
	return nil
}
func (s *Store) SetRetention(ctx context.Context, raw, history int, actor string) error {
	if raw < 1 || raw > s.rawLimit || history < raw || history > s.historyLimit {
		return ErrRetention
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	tx, err := s.State.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	for key, value := range map[string]int{"raw_days": raw, "history_days": history} {
		if _, err = tx.ExecContext(ctx, "INSERT INTO preferences VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value", key, value); err != nil {
			return err
		}
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO audits(time,actor,action,result) VALUES(?,?,?,?)", time.Now().Unix(), actor, "retention-updated", "success"); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	s.rawDays.Store(int64(raw))
	s.historyDays.Store(int64(history))
	return nil
}
