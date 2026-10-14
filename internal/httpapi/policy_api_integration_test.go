//go:build integration

package httpapi

import (
	"encoding/json"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"

	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/fixture"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
)

func TestPolicyAPIValidationAndCoverage(t *testing.T) {
	dir := t.TempDir()
	s, err := store.Open(filepath.Join(dir, "state"), filepath.Join(dir, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	if err = fixture.Seed(t.Context(), s); err != nil {
		t.Fatal(err)
	}
	if err = auth.Provision(t.Context(), s, "recovery", "disposable-fixture-password"); err != nil {
		t.Fatal(err)
	}
	cfg := config.Config{Fixture: true, Origins: []string{"http://127.0.0.1:8080"}, SessionHours: 1, WebDir: dir, Producers: []config.Producer{{ID: "missing-policy", Kinds: []string{"rule", "application"}}, {ID: "missing-device", Kinds: []string{"device"}}}}
	handler := New(s, auth.New(s, cfg), cfg, "test").Handler()
	request := httptest.NewRequest("POST", cfg.Origins[0]+"/api/v1/auth/login", strings.NewReader(`{"username":"recovery","password":"disposable-fixture-password"}`))
	request.Header.Set("Content-Type", "application/json")
	request.Header.Set("Origin", cfg.Origins[0])
	login := httptest.NewRecorder()
	handler.ServeHTTP(login, request)
	if login.Code != 200 {
		t.Fatal(login.Code)
	}
	cookie := login.Result().Cookies()[0]
	for _, tc := range []struct {
		path      string
		status    int
		sourceKey string
	}{
		{"/api/v1/policies?evidence=installed", 200, "sources"},
		{"/api/v1/policies?evidence=unknown", 200, "sources"},
		{"/api/v1/policies?evidence=invalid", 400, ""},
		{"/api/v1/devices/lab-server", 200, "policy_sources"},
	} {
		t.Run(tc.path, func(t *testing.T) {
			r := httptest.NewRequest("GET", cfg.Origins[0]+tc.path, nil)
			r.AddCookie(cookie)
			w := httptest.NewRecorder()
			handler.ServeHTTP(w, r)
			if w.Code != tc.status {
				t.Fatalf("status %d want %d", w.Code, tc.status)
			}
			if tc.sourceKey != "" {
				var envelope map[string]json.RawMessage
				if err := json.Unmarshal(w.Body.Bytes(), &envelope); err != nil {
					t.Fatal(err)
				}
				var sources []model.Source
				if err := json.Unmarshal(envelope[tc.sourceKey], &sources); err != nil {
					t.Fatal(err)
				}
				found := false
				for _, source := range sources {
					if source.ID == "missing-device" {
						t.Fatal("device-only source leaked into policy coverage")
					}
					if source.ID == "missing-policy" {
						found = source.Status == "missing"
					}
				}
				if !found {
					t.Fatal("configured missing policy source is not visible")
				}
			}
		})
	}
}
