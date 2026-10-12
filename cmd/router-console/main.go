// Command router-console runs the standalone appliance observatory or provisions local recovery.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/fixture"
	"github.com/mikenorgate/router-ui/internal/httpapi"
	"github.com/mikenorgate/router-ui/internal/ingest"
	"github.com/mikenorgate/router-ui/internal/preflight"
	"github.com/mikenorgate/router-ui/internal/server"
	"github.com/mikenorgate/router-ui/internal/store"
)

var version = "dev"

func main() {
	if err := run(); err != nil {
		slog.Error("console stopped", "error", err)
		os.Exit(1)
	}
}
func run() error {
	fs := flag.NewFlagSet("router-console", flag.ContinueOnError)
	path := fs.String("config", "", "installation configuration JSON (required)")
	setup := fs.String("setup-user", "", "provision local recovery account through trusted setup")
	passwordFile := fs.String("password-file", "", "setup credential file, never a command-line password")
	check := fs.Bool("check", false, "validate configuration and exit")
	showVersion := fs.Bool("version", false, "print build version")
	if err := fs.Parse(os.Args[1:]); err != nil {
		return err
	}
	if *showVersion {
		fmt.Println(version)
		return nil
	}
	if *path == "" {
		return errors.New("-config is required")
	}
	cfg, err := config.Load(*path)
	if err != nil {
		return err
	}
	if *check {
		fmt.Println("configuration valid")
		return nil
	}
	if err = preflight.Check(cfg); err != nil {
		return err
	}
	s, err := store.Open(cfg.StateDir, cfg.HistoryDir, cfg.SQLiteBudget, cfg.StateBudget, cfg.RawDays, cfg.HistoryDays)
	if err != nil {
		return err
	}
	defer s.Close()
	if *setup != "" {
		if *passwordFile == "" {
			return errors.New("setup requires -password-file")
		}
		info, err := os.Stat(*passwordFile)
		if err != nil {
			return err
		}
		if info.Mode().Perm()&0077 != 0 || info.Size() > 1025 {
			return errors.New("credential file must be private and at most 1025 bytes")
		}
		password, err := os.ReadFile(*passwordFile)
		if err != nil {
			return err
		}
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		return auth.Provision(ctx, s, *setup, strings.TrimRight(string(password), "\r\n"))
	}
	if !cfg.Fixture && os.Geteuid() == 0 {
		return errors.New("production web service must run as an unprivileged user")
	}
	if cfg.Fixture {
		if err = fixture.Seed(context.Background(), s); err != nil {
			return err
		}
		slog.Warn("explicit fixture mode enabled; observations are synthetic")
	}
	a := auth.New(s, cfg)
	api := httpapi.New(s, a, cfg, version)
	runtime := server.New(cfg)
	api.Runtime = runtime.Snapshot
	local := ingest.New(s, cfg.Producers)
	local.Health = func() map[string]float64 {
		m := runtime.Health()
		m["login_success_total"] = float64(a.LoginSuccess.Load())
		m["login_failure_total"] = float64(a.LoginFailure.Load())
		return m
	}
	if err = runtime.Start(api.Handler(), local); err != nil {
		return err
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	reload := make(chan os.Signal, 1)
	signal.Notify(reload, syscall.SIGHUP)
	defer signal.Stop(reload)
	timer := time.NewTicker(time.Minute)
	defer timer.Stop()
	slog.Info("console started", "version", version, "listeners", len(cfg.Listen))
	for {
		select {
		case <-ctx.Done():
			shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
			defer cancel()
			return runtime.Close(shutdown)
		case <-reload:
			if err := runtime.Reload(); err != nil {
				slog.Error("certificate reload failed; keeping previous valid certificates")
			}
		case <-timer.C:
			if err := runtime.Reload(); err != nil {
				slog.Error("certificate reload failed")
			}
			maintenance, cancel := context.WithTimeout(ctx, 10*time.Second)
			err := s.Maintenance(maintenance, time.Now())
			cancel()
			if err != nil {
				slog.Error("history maintenance failed", "error", err)
			}
		}
	}
}
