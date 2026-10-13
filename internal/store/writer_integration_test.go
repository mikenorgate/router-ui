//go:build integration

package store

import (
	"database/sql"
	"database/sql/driver"
	"errors"
	"testing"
)

func checkWriterConfiguration(t *testing.T, db *sql.DB, budget int64) {
	t.Helper()
	for _, setting := range []struct {
		name  string
		value int64
	}{
		{"cache_size", -32768}, {"synchronous", 2}, {"foreign_keys", 1},
		{"busy_timeout", 3000}, {"wal_autocheckpoint", 128},
		{"journal_size_limit", 1048576}, {"max_page_count", budget * 9 / 10 / 4096},
	} {
		var value int64
		// Names are a fixed test-owned allowlist, never request parameters.
		if err := db.QueryRowContext(t.Context(), "PRAGMA "+setting.name).Scan(&value); err != nil {
			t.Fatal(err)
		}
		if value != setting.value {
			t.Errorf("%s=%d, want %d", setting.name, value, setting.value)
		}
	}
}

func TestReplacementWriterRetainsDurabilityCapacityAndForeignKeys(t *testing.T) {
	s := snapshotStore(t)
	for _, writer := range []struct {
		name   string
		db     *sql.DB
		budget int64
	}{
		{"history", s.history, 64 << 20}, {"state", s.State, 8 << 20},
	} {
		t.Run(writer.name, func(t *testing.T) {
			checkWriterConfiguration(t, writer.db, writer.budget)
			connection, err := writer.db.Conn(t.Context())
			if err != nil {
				t.Fatal(err)
			}
			err = connection.Raw(func(any) error { return driver.ErrBadConn })
			if !errors.Is(err, driver.ErrBadConn) {
				t.Fatalf("replace physical connection: %v", err)
			}
			if err = connection.Close(); err != nil && !errors.Is(err, sql.ErrConnDone) {
				t.Fatal(err)
			}
			checkWriterConfiguration(t, writer.db, writer.budget)
		})
	}
	if _, err := s.history.ExecContext(t.Context(),
		"INSERT INTO staged_chunks VALUES('missing-parent',0,x'00',1)"); err == nil {
		t.Fatal("replacement writer accepted a foreign-key violation")
	}
	if _, err := s.history.ExecContext(t.Context(),
		"INSERT INTO staged_snapshots VALUES('quota-fixture','{}',0)"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.history.ExecContext(t.Context(),
		"INSERT INTO staged_chunks VALUES('quota-fixture',0,zeroblob(1024),1)"); err != nil {
		t.Fatal(err)
	}
	if _, err := s.history.ExecContext(t.Context(),
		"INSERT INTO staged_chunks VALUES('quota-fixture',1,zeroblob(?),1)", 64<<20); err == nil {
		t.Fatal("replacement writer exceeded its database capacity limit")
	}
	var rows int
	if err := s.history.QueryRowContext(t.Context(),
		"SELECT COUNT(*) FROM staged_chunks WHERE source='quota-fixture'").Scan(&rows); err != nil || rows != 1 {
		t.Fatalf("capacity failure changed durable rows: count=%d error=%v", rows, err)
	}
}
