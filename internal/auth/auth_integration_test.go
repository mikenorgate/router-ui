//go:build integration

package auth

import (
	"context"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"testing"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/store"
)

func authTest(t *testing.T) (*Auth, *store.Store) {
	t.Helper()
	d := t.TempDir()
	s, err := store.Open(filepath.Join(d, "state"), filepath.Join(d, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { s.Close() })
	return New(s, config.Config{SessionHours: 1}), s
}
func TestLocalRecoveryAndHostBoundSession(t *testing.T) {
	a, s := authTest(t)
	ctx := context.Background()
	if err := Provision(ctx, s, "recovery", "correct-horse-example"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := a.Local(ctx, "missing", "wrong", "1", "https://router.example"); !errors.Is(err, ErrDenied) {
		t.Fatal(err)
	}
	session, raw, err := a.Local(ctx, "recovery", "correct-horse-example", "1", "https://router.example")
	if err != nil {
		t.Fatal(err)
	}
	if session.User.Role != "admin" || !CSRF(session, session.CSRF) || CSRF(session, "wrong") {
		t.Fatal("session role or CSRF invalid")
	}
	if _, err = a.Resolve(ctx, raw, "https://other.example"); !errors.Is(err, ErrDenied) {
		t.Fatal("session crossed origin")
	}
	w := httptest.NewRecorder()
	a.Cookie(w, raw)
	c := w.Result().Cookies()[0]
	if !c.Secure || !c.HttpOnly || c.Domain != "" || c.Name != "__Host-"+CookieName {
		t.Fatalf("insecure cookie: %+v", c)
	}
	if err = Provision(ctx, s, "recovery", "changed-horse-example"); err != nil {
		t.Fatal(err)
	}
	if _, err = a.Resolve(ctx, raw, "https://router.example"); !errors.Is(err, ErrDenied) {
		t.Fatal("recovery reset did not revoke sessions")
	}
}
func TestOIDCStateReplayAndBrowserBinding(t *testing.T) {
	a, _ := authTest(t)
	for _, tc := range []struct {
		name            string
		origin, browser string
		expired         bool
	}{{"wrong browser", "https://router.example", "wrong", false}, {"wrong origin", "https://other.example", "browser", false}, {"expired", "https://router.example", "browser", true}} {
		t.Run(tc.name, func(t *testing.T) {
			f := flow{origin: "https://router.example", browser: digest("browser")}
			if !tc.expired {
				f.expires = f.expires.AddDate(3000, 0, 0)
			}
			a.flows[tc.name] = f
			if _, _, err := a.Finish(context.Background(), tc.origin, tc.name, tc.browser, "code"); !errors.Is(err, ErrDenied) {
				t.Fatal(err)
			}
			if _, ok := a.flows[tc.name]; ok {
				t.Fatal("state not consumed")
			}
		})
	}
}
