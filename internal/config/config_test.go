package config

import "testing"

func validFixture() Config {
	return Config{Listen: []string{"127.0.0.1:8080", "[::1]:8080"}, Origins: []string{"http://127.0.0.1:8080"}, Fixture: true, StateDir: "/tmp/console/state", HistoryDir: "/tmp/console/history", WebDir: "/tmp/console/web", IngestSocket: "/tmp/console/ingest.sock", SQLiteBudget: 32 << 20, StateBudget: 8 << 20, RawDays: 7, HistoryDays: 90, SessionHours: 8}
}
func TestUnsafeConfigurationsRejected(t *testing.T) {
	for _, tc := range []struct {
		name   string
		change func(*Config)
	}{{"wildcard", func(c *Config) { c.Listen = []string{"0.0.0.0:8080"} }}, {"fixture on network", func(c *Config) { c.Listen = []string{"192.0.2.1:8080"} }}, {"origin with path", func(c *Config) { c.Origins = []string{"http://127.0.0.1:8080/path"} }}, {"unbounded retention", func(c *Config) { c.HistoryDays = 1000 }}, {"shared state tree", func(c *Config) { c.HistoryDir = c.StateDir + "/history" }}, {"remote metrics dependency", func(c *Config) { c.PrometheusURL = "https://monitoring.example" }}, {"OIDC without roles", func(c *Config) { c.OIDC = OIDC{Issuer: "https://idp.example", ClientID: "console"} }}} {
		t.Run(tc.name, func(t *testing.T) {
			c := validFixture()
			tc.change(&c)
			if err := c.Validate(); err == nil {
				t.Fatal("unsafe configuration accepted")
			}
		})
	}
	c := validFixture()
	if err := c.Validate(); err != nil {
		t.Fatal(err)
	}
}
