//go:build integration

package httpapi

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/fixture"
	"github.com/mikenorgate/router-ui/internal/store"
)

func TestAuthorizationOriginAndCSRF(t *testing.T) {
	d := t.TempDir()
	s, err := store.Open(filepath.Join(d, "state"), filepath.Join(d, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	ctx := context.Background()
	if err = fixture.Seed(ctx, s); err != nil {
		t.Fatal(err)
	}
	if err = auth.Provision(ctx, s, "recovery", "correct-horse-example"); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{Fixture: true, Origins: []string{"http://127.0.0.1:8080"}, SessionHours: 1, WebDir: d}
	a := auth.New(s, cfg)
	handler := New(s, a, cfg, "test").Handler()
	request := func(method, path, body, origin, csrf string, cookie *http.Cookie) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://127.0.0.1:8080"+path, strings.NewReader(body))
		r.Header.Set("Content-Type", "application/json")
		if origin != "" {
			r.Header.Set("Origin", origin)
		}
		if csrf != "" {
			r.Header.Set("X-CSRF-Token", csrf)
		}
		if cookie != nil {
			r.AddCookie(cookie)
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	login := request("POST", "/api/v1/auth/login", `{"username":"recovery","password":"correct-horse-example"}`, cfg.Origins[0], "", nil)
	if login.Code != 200 {
		t.Fatalf("login: %d %s", login.Code, login.Body.String())
	}
	cookie := login.Result().Cookies()[0]
	var session auth.Session
	if err = json.Unmarshal(login.Body.Bytes(), &session); err != nil {
		t.Fatal(err)
	}
	for _, tc := range []struct {
		name, method, path, body, origin, csrf string
		status                                 int
		authenticated                          bool
	}{
		{"anonymous inventory", "GET", "/api/v1/devices", "", "", "", 401, false},
		{"authenticated inventory", "GET", "/api/v1/devices", "", "", "", 200, true},
		{"missing csrf", "POST", "/api/v1/devices/lab-server/annotation", `{"alias":"test","note":"hello"}`, cfg.Origins[0], "", 403, true},
		{"wrong origin", "POST", "/api/v1/devices/lab-server/annotation", `{"alias":"test","note":"hello"}`, "https://attacker.example", session.CSRF, 403, true},
		{"authorized annotation", "POST", "/api/v1/devices/lab-server/annotation", `{"alias":"test","note":"<script>unsafe</script>"}`, cfg.Origins[0], session.CSRF, 200, true},
		{"bounded query", "GET", "/api/v1/flows?limit=999999", "", "", "", 400, true},
		{"export", "GET", "/api/v1/export?kind=flows", "", "", "", 200, true},
	} {
		t.Run(tc.name, func(t *testing.T) {
			var c *http.Cookie
			if tc.authenticated {
				c = cookie
			}
			w := request(tc.method, tc.path, tc.body, tc.origin, tc.csrf, c)
			if w.Code != tc.status {
				t.Fatalf("status %d expected %d: %s", w.Code, tc.status, w.Body.String())
			}
			if w.Header().Get("Cache-Control") != "no-store" {
				t.Fatal("private API response is cacheable")
			}
		})
	}
	flows := request("GET", "/api/v1/flows?limit=1", "", "", "", cookie)
	var listing struct {
		Items []struct {
			Ref string `json:"observation_ref"`
		} `json:"items"`
	}
	if err = json.Unmarshal(flows.Body.Bytes(), &listing); err != nil || len(listing.Items) != 1 || listing.Items[0].Ref == "" {
		t.Fatalf("missing reference %s", flows.Body.String())
	}
	ref := listing.Items[0].Ref
	for _, path := range []string{"/api/v1/observations/" + ref, "/api/v1/investigations/" + ref, "/api/v1/traffic/summary", "/api/v1/exposure"} {
		w := request("GET", path, "", "", "", cookie)
		if w.Code != 200 {
			t.Fatalf("new API %s %d %s", path, w.Code, w.Body.String())
		}
		if strings.Contains(w.Body.String(), "predicted_outcome") {
			t.Fatal("passive investigation returned simulation")
		}
	}
	if w := request("GET", "/api/v1/traffic/summary?from=2026-01-01T00:00:00Z&to=2026-03-01T00:00:00Z", "", "", "", cookie); w.Code != 400 {
		t.Fatal("unbounded activity query accepted")
	}
	if _, err = s.State.Exec("UPDATE sessions SET role='viewer'"); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{"/api/v1/flows", "/api/v1/dns", "/api/v1/export?kind=flows", "/api/v1/admin/audit", "/api/v1/observations/invalid", "/api/v1/investigations/invalid"} {
		w := request("GET", path, "", "", "", cookie)
		if w.Code != 403 {
			t.Fatalf("viewer access %s: %d", path, w.Code)
		}
	}
	detail := request("GET", "/api/v1/devices/lab-server", "", "", "", cookie)
	var body map[string]json.RawMessage
	if err = json.Unmarshal(detail.Body.Bytes(), &body); err != nil {
		t.Fatal(err)
	}
	if string(body["flows"]) != "[]" || string(body["detail_restricted"]) != "true" {
		t.Fatalf("viewer detailed traffic leaked: %s", detail.Body.String())
	}
	spoof := httptest.NewRequest("GET", "http://attacker.example/api/v1/session", nil)
	spoof.AddCookie(cookie)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, spoof)
	if w.Code != 421 {
		t.Fatal("unconfigured host accepted")
	}
}
