//go:build integration

package store

import (
	"context"
	"database/sql"
	"encoding/json"
	"github.com/mikenorgate/router-ui/internal/model"
	"testing"
	"time"
)

func TestHistoryReadersSeeCommittedGenerationDuringWrite(t *testing.T) {
	s := snapshotStore(t)
	now := time.Now().UTC()
	chunks, manifest := snapshot(t, 1, "devices", []model.Record{deviceRecord(t, "test:old", now)}, now)
	commit(t, s, chunks, manifest, now)
	tx, err := s.history.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	if _, err = tx.Exec("DELETE FROM latest WHERE kind='device'"); err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), time.Second)
	defer cancel()
	records, err := s.Query(ctx, "device", Query{Limit: 10})
	if err != nil || len(records) != 1 {
		t.Fatalf("read during write: %d records, %v", len(records), err)
	}
	var device map[string]any
	if err = json.Unmarshal(records[0], &device); err != nil {
		t.Fatal(err)
	}
	if device["id"] != "test:old" {
		t.Fatalf("uncommitted data visible: %v", device)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	records, err = s.Query(context.Background(), "device", Query{Limit: 10})
	if err != nil || len(records) != 0 {
		t.Fatalf("new commit invisible: %d records, %v", len(records), err)
	}
}

func TestEveryHistoryReaderConnectionRejectsWrites(t *testing.T) {
	s := snapshotStore(t)
	// Keep all four connections borrowed so the per-connection guard is tested.
	var connections []*sql.Conn
	defer func() {
		for _, connection := range connections {
			connection.Close()
		}
	}()
	for range 4 {
		connection, err := s.read.Conn(context.Background())
		if err != nil {
			t.Fatal(err)
		}
		connections = append(connections, connection)
		if _, err = connection.ExecContext(context.Background(), "DELETE FROM latest"); err == nil {
			t.Fatal("reader can mutate history")
		}
	}
}

func TestHistoricalReadsRemainConsistentDuringRetention(t *testing.T) {
	s := snapshotStore(t)
	old := time.Now().UTC().AddDate(0, 0, -100)
	done := make(chan error, 1)
	go func() {
		for sequence := uint64(1); sequence <= 20; sequence++ {
			chunks, manifest := snapshot(t, sequence, "devices", []model.Record{deviceRecord(t, "test:old", old)}, old)
			for _, chunk := range chunks {
				if err := s.StageChunk(t.Context(), chunk, old); err != nil {
					done <- err
					return
				}
			}
			if _, err := s.CommitSnapshot(t.Context(), manifest, old); err != nil {
				done <- err
				return
			}
			if err := s.Maintenance(t.Context(), time.Now().UTC()); err != nil {
				done <- err
				return
			}
		}
		done <- nil
	}()
	for {
		select {
		case err := <-done:
			if err != nil {
				t.Fatal(err)
			}
			return
		default:
			ctx, cancel := context.WithTimeout(t.Context(), 2*time.Second)
			rows, err := s.Query(ctx, "device", Query{History: true, From: old.Add(-time.Hour), Limit: 10})
			cancel()
			if err != nil || len(rows) > 1 {
				t.Errorf("history during retention: %d, %v", len(rows), err)
				<-done
				return
			}
		}
	}
}
