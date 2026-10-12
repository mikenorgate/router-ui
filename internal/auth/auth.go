// Package auth implements console-only identities, bounded sessions and local recovery.
package auth

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
	"golang.org/x/crypto/argon2"
)

var ErrDenied = errors.New("invalid credentials or access not mapped")
var ErrLimited = errors.New("too many login attempts")

const CookieName = "router_console_session"

type User struct {
	ID   string `json:"id"`
	Name string `json:"name"`
	Role string `json:"role"`
}
type Session struct {
	User User   `json:"user"`
	CSRF string `json:"csrf_token"`
	Mode string `json:"mode"`
}
type attempt struct {
	count int
	until time.Time
}
type flow struct {
	nonce, verifier, origin, browser string
	expires                          time.Time
}
type Auth struct {
	LoginSuccess atomic.Uint64
	LoginFailure atomic.Uint64
	store        *store.Store
	cfg          config.Config
	mu           sync.Mutex
	attempts     map[string]attempt
	flows        map[string]flow
	hashSlots    chan struct{}
	httpClient   *http.Client // Optional transport injection for protocol tests; production uses a bounded HTTPS client.
}

func New(s *store.Store, c config.Config) *Auth {
	return &Auth{store: s, cfg: c, attempts: map[string]attempt{}, flows: map[string]flow{}, hashSlots: make(chan struct{}, 2)}
}
func token() string {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		panic("operating system random source unavailable")
	}
	return base64.RawURLEncoding.EncodeToString(b)
}
func digest(s string) string { h := sha256.Sum256([]byte(s)); return hex.EncodeToString(h[:]) }
func Hash(password string) (string, error) {
	if len(password) < 12 || len(password) > 1024 {
		return "", errors.New("password must be 12–1024 bytes")
	}
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return "", err
	}
	h := argon2.IDKey([]byte(password), salt, 2, 64*1024, 2, 32)
	return "argon2id-v1$" + base64.RawStdEncoding.EncodeToString(salt) + "$" + base64.RawStdEncoding.EncodeToString(h), nil
}
func verify(encoded, password string) bool {
	parts := strings.Split(encoded, "$")
	if len(parts) != 3 || parts[0] != "argon2id-v1" || len(password) > 1024 {
		return false
	}
	salt, e := base64.RawStdEncoding.DecodeString(parts[1])
	want, f := base64.RawStdEncoding.DecodeString(parts[2])
	if e != nil || f != nil || len(salt) != 16 || len(want) != 32 {
		return false
	}
	got := argon2.IDKey([]byte(password), salt, 2, 64*1024, 2, 32)
	return subtle.ConstantTimeCompare(got, want) == 1
}
func Provision(ctx context.Context, s *store.Store, name, password string) error {
	if !model.Identifier(name) {
		return errors.New("username must be a bounded identifier")
	}
	hash, err := Hash(password)
	if err != nil {
		return err
	}
	tx, err := s.State.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `INSERT INTO accounts VALUES(?,?,?,'admin') ON CONFLICT(id) DO UPDATE SET password=excluded.password,role='admin'`, "local:"+name, name, hash); err != nil {
		return err
	}
	if _, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE user_id=?", "local:"+name); err != nil {
		return err
	}
	if err = tx.Commit(); err != nil {
		return err
	}
	return s.Audit(ctx, "trusted-setup", "local-account-provisioned", "success")
}
func (a *Auth) allow(key string) bool {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	for k, v := range a.attempts {
		if now.After(v.until) {
			delete(a.attempts, k)
		}
	}
	if len(a.attempts) >= 1024 {
		return false
	}
	v := a.attempts[key]
	if v.until.IsZero() {
		v.until = now.Add(5 * time.Minute)
	}
	v.count++
	a.attempts[key] = v
	return v.count <= 8
}
func (a *Auth) Local(ctx context.Context, name, password, ip, origin string) (result Session, rawToken string, returnErr error) {
	defer func() {
		if returnErr != nil {
			a.LoginFailure.Add(1)
		}
	}()
	if !a.allow(ip) {
		return Session{}, "", ErrLimited
	}
	select {
	case a.hashSlots <- struct{}{}:
		defer func() { <-a.hashSlots }()
	default:
		return Session{}, "", ErrLimited
	}
	var u User
	var encoded string
	err := a.store.State.QueryRowContext(ctx, "SELECT id,name,role,password FROM accounts WHERE name=?", name).Scan(&u.ID, &u.Name, &u.Role, &encoded)
	if errors.Is(err, sql.ErrNoRows) {
		encoded = "argon2id-v1$AAAAAAAAAAAAAAAAAAAAAA$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"
	} else if err != nil {
		return Session{}, "", err
	}
	good := verify(encoded, password)
	if !good || err != nil {
		if e := a.store.Audit(ctx, "local-login", "login", "denied"); e != nil {
			return Session{}, "", e
		}
		return Session{}, "", ErrDenied
	}
	if err = a.store.Audit(ctx, u.ID, "local-recovery-login", "success"); err != nil {
		return Session{}, "", err
	}
	return a.create(ctx, u, origin)
}
func (a *Auth) create(ctx context.Context, u User, origin string) (Session, string, error) {
	raw, csrf := token(), token()
	mode := "production"
	if a.cfg.Fixture {
		mode = "fixture"
	}
	out := Session{User: u, CSRF: csrf, Mode: mode}
	tx, err := a.store.State.BeginTx(ctx, nil)
	if err != nil {
		return out, "", err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, "DELETE FROM sessions WHERE expires<=?", time.Now().Unix()); err != nil {
		return out, "", err
	}
	var count int
	if err = tx.QueryRowContext(ctx, "SELECT COUNT(*) FROM sessions").Scan(&count); err != nil {
		return out, "", err
	}
	if count >= 512 {
		return out, "", ErrLimited
	}
	if _, err = tx.ExecContext(ctx, "INSERT INTO sessions VALUES(?,?,?,?,?,?,?)", digest(raw), u.ID, u.Name, u.Role, csrf, origin, time.Now().Add(time.Duration(a.cfg.SessionHours)*time.Hour).Unix()); err != nil {
		return out, "", err
	}
	err = tx.Commit()
	if err == nil {
		a.LoginSuccess.Add(1)
	}
	return out, raw, err
}
func (a *Auth) Resolve(ctx context.Context, raw, origin string) (Session, error) {
	var s Session
	if len(raw) != 43 {
		return s, ErrDenied
	}
	err := a.store.State.QueryRowContext(ctx, "SELECT user_id,name,role,csrf FROM sessions WHERE hash=? AND origin=? AND expires>?", digest(raw), origin, time.Now().Unix()).Scan(&s.User.ID, &s.User.Name, &s.User.Role, &s.CSRF)
	s.Mode = "production"
	if a.cfg.Fixture {
		s.Mode = "fixture"
	}
	if errors.Is(err, sql.ErrNoRows) {
		err = ErrDenied
	}
	return s, err
}
func (a *Auth) Revoke(ctx context.Context, raw string) error {
	_, err := a.store.State.ExecContext(ctx, "DELETE FROM sessions WHERE hash=?", digest(raw))
	return err
}
func (a *Auth) Cookie(w http.ResponseWriter, raw string) {
	maxAge := a.cfg.SessionHours * 3600
	if raw == "" {
		maxAge = -1
	}
	http.SetCookie(w, &http.Cookie{Name: a.CookieName(), Value: raw, Path: "/", Secure: !a.cfg.Fixture, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: maxAge})
}
func (a *Auth) CookieName() string {
	if !a.cfg.Fixture {
		return "__Host-" + CookieName
	}
	return CookieName
}
func Can(role, required string) bool {
	levels := map[string]int{"viewer": 1, "operator": 2, "admin": 3}
	return levels[role] >= levels[required] && levels[required] > 0
}
func CSRF(s Session, value string) bool {
	return len(value) == 43 && subtle.ConstantTimeCompare([]byte(s.CSRF), []byte(value)) == 1
}
