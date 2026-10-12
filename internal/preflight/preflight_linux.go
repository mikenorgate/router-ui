//go:build linux

// Package preflight rejects unsafe application placement without modifying router storage.
package preflight

import (
	"errors"
	"os"
	"syscall"

	"github.com/mikenorgate/router-ui/internal/config"
)

func Check(c config.Config) error {
	if c.Fixture {
		return nil
	}
	// Directories must already exist: never create a telemetry tree on the underlying /var
	// when the router-owned bounded mount failed to start.
	state, err := os.Stat(c.StateDir)
	if err != nil {
		return err
	}
	history, err := os.Stat(c.HistoryDir)
	if err != nil {
		return err
	}
	ss, ok := state.Sys().(*syscall.Stat_t)
	if !ok {
		return errors.New("state filesystem identity unavailable")
	}
	hs, ok := history.Sys().(*syscall.Stat_t)
	if !ok || ss.Dev == hs.Dev {
		return errors.New("telemetry must be on a separate bounded filesystem provisioned by the router")
	}
	var fs syscall.Statfs_t
	if err = syscall.Statfs(c.HistoryDir, &fs); err != nil {
		return err
	}
	total := fs.Blocks * uint64(fs.Bsize)
	if total < uint64(c.SQLiteBudget) {
		return errors.New("telemetry filesystem is smaller than the SQLite budget")
	}
	if _, err = os.Stat(c.WebDir + "/index.html"); err != nil {
		return errors.New("built frontend assets are missing")
	}
	return nil
}
