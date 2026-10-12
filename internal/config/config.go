// Package config validates the installation contract without inspecting router state.
package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/netip"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

type Producer struct {
	ID    string   `json:"id"`
	UID   uint32   `json:"uid"`
	Kinds []string `json:"kinds"`
}
type Certificate struct {
	CertFile string `json:"cert_file"`
	KeyFile  string `json:"key_file"`
}
type MetricQuery struct {
	Query          string `json:"query"`
	TimestampQuery string `json:"timestamp_query"`
	Label          string `json:"label"`
	Unit           string `json:"unit"`
	Scope          string `json:"scope"`
}
type OIDC struct {
	Issuer           string            `json:"issuer"`
	ClientID         string            `json:"client_id"`
	ClientSecretFile string            `json:"client_secret_file"`
	Name             string            `json:"name"`
	SubjectRoles     map[string]string `json:"subject_roles"`
	GroupClaim       string            `json:"group_claim"`
	GroupRoles       map[string]string `json:"group_roles"`
	Scopes           []string          `json:"scopes"`
}
type Config struct {
	Listen        []string               `json:"listen"`
	Origins       []string               `json:"origins"`
	Certificates  []Certificate          `json:"certificates"`
	StateDir      string                 `json:"state_dir"`
	HistoryDir    string                 `json:"history_dir"`
	WebDir        string                 `json:"web_dir"`
	IngestSocket  string                 `json:"ingest_socket"`
	Producers     []Producer             `json:"producers"`
	SQLiteBudget  int64                  `json:"sqlite_budget_bytes"`
	StateBudget   int64                  `json:"state_budget_bytes"`
	RawDays       int                    `json:"raw_days"`
	HistoryDays   int                    `json:"history_days"`
	SessionHours  int                    `json:"session_hours"`
	PrometheusURL string                 `json:"prometheus_url"`
	MetricQueries map[string]MetricQuery `json:"metric_queries"`
	OIDC          OIDC                   `json:"oidc"`
	Fixture       bool                   `json:"fixture"`
}

func Load(path string) (Config, error) {
	var c Config
	f, err := os.Open(path)
	if err != nil {
		return c, err
	}
	defer f.Close()
	d := json.NewDecoder(io.LimitReader(f, 65536))
	d.DisallowUnknownFields()
	if err = d.Decode(&c); err != nil {
		return c, err
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		return c, errors.New("configuration must contain one JSON object")
	}
	return c, c.Validate()
}
func (c Config) Validate() error {
	if len(c.Listen) == 0 || len(c.Listen) > 16 || len(c.Origins) == 0 || len(c.Origins) > 32 {
		return errors.New("explicit listen addresses and origins required")
	}
	for _, a := range c.Listen {
		host, _, err := net.SplitHostPort(a)
		ip, e := netip.ParseAddr(host)
		if err != nil || e != nil || ip.IsUnspecified() {
			return fmt.Errorf("listen address must be a specific IP: %s", a)
		}
		if c.Fixture && !ip.IsLoopback() {
			return errors.New("fixture mode can only bind loopback")
		}
	}
	for _, s := range c.Origins {
		u, err := url.Parse(s)
		if err != nil || u.Host == "" || u.Path != "" || u.RawQuery != "" || u.Fragment != "" || u.User != nil {
			return errors.New("origin must be an exact scheme and authority")
		}
		schemeAllowed := u.Scheme == "https" || c.Fixture && u.Scheme == "http"
		if !schemeAllowed {
			return errors.New("production origins require HTTPS")
		}
		if c.Fixture {
			ip, e := netip.ParseAddr(u.Hostname())
			if e != nil || !ip.IsLoopback() {
				return errors.New("fixture origins must use loopback IPs")
			}
		}
	}
	if !c.Fixture && len(c.Certificates) == 0 {
		return errors.New("production TLS certificates required")
	}
	for _, p := range []string{c.StateDir, c.HistoryDir, c.WebDir, c.IngestSocket} {
		if !filepath.IsAbs(p) {
			return errors.New("storage, web and socket paths must be absolute")
		}
	}
	if c.StateDir == c.HistoryDir || strings.HasPrefix(c.StateDir, c.HistoryDir+"/") || strings.HasPrefix(c.HistoryDir, c.StateDir+"/") {
		return errors.New("durable state and telemetry must use separate directories")
	}
	if c.SQLiteBudget < 16<<20 || c.StateBudget < 4<<20 || c.RawDays < 1 || c.RawDays > 7 || c.HistoryDays < c.RawDays || c.HistoryDays > 90 || c.SessionHours < 1 || c.SessionHours > 24 {
		return errors.New("invalid storage or session limits")
	}
	seen := map[string]bool{}
	for _, p := range c.Producers {
		if p.ID == "" || seen[p.ID] || len(p.Kinds) == 0 {
			return errors.New("invalid or duplicate producer")
		}
		seen[p.ID] = true
		for _, k := range p.Kinds {
			switch k {
			case "device", "flow", "policy", "dns", "event", "network", "rule", "application", "appliance":
			default:
				return errors.New("unsupported producer kind")
			}
		}
	}
	if c.PrometheusURL != "" {
		u, err := url.Parse(c.PrometheusURL)
		if err != nil || u.User != nil || u.Path != "" || u.RawQuery != "" || u.Fragment != "" {
			return errors.New("invalid Prometheus URL")
		}
		ip, e := netip.ParseAddr(u.Hostname())
		if e != nil || !ip.IsLoopback() || u.Scheme != "http" {
			return errors.New("prometheus must be a local loopback HTTP service")
		}
	}
	if c.OIDC.Issuer != "" {
		u, err := url.Parse(c.OIDC.Issuer)
		if err != nil || u.Scheme != "https" || u.Host == "" || u.User != nil || u.RawQuery != "" || u.Fragment != "" || c.OIDC.ClientID == "" {
			return errors.New("OIDC requires an HTTPS issuer and client ID")
		}
		if len(c.OIDC.SubjectRoles) == 0 && len(c.OIDC.GroupRoles) == 0 {
			return errors.New("OIDC requires explicit role mappings")
		}
	}
	for id, q := range c.MetricQueries {
		switch id {
		case "download", "upload", "cpu", "memory", "latency", "loss", "conntrack", "drops":
		default:
			return errors.New("unknown metric catalog ID")
		}
		if len(q.Query) == 0 || len(q.Query) > 2048 || q.Label == "" || q.Scope == "" {
			return errors.New("invalid metric catalog entry")
		}
	}
	for _, roles := range []map[string]string{c.OIDC.SubjectRoles, c.OIDC.GroupRoles} {
		for _, r := range roles {
			if r != "viewer" && r != "operator" && r != "admin" {
				return errors.New("invalid OIDC role mapping")
			}
		}
	}
	return nil
}
