package auth

import (
	"context"
	"crypto/subtle"
	"errors"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/coreos/go-oidc/v3/oidc"
	"golang.org/x/oauth2"
)

var ErrProvider = errors.New("identity provider unavailable; use local recovery or try again")

// Discovery is done on demand so provider outages never prevent console startup or local recovery.
func (a *Auth) provider(ctx context.Context, origin string) (*oidc.Provider, oauth2.Config, error) {
	if a.cfg.OIDC.Issuer == "" {
		return nil, oauth2.Config{}, ErrDenied
	}
	client := &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(r *http.Request, via []*http.Request) error {
		if len(via) > 3 || r.URL.Scheme != "https" {
			return errors.New("invalid identity provider redirect")
		}
		return nil
	}}
	if a.httpClient != nil {
		client = a.httpClient
	}
	ctx = oidc.ClientContext(ctx, client)
	p, err := oidc.NewProvider(ctx, a.cfg.OIDC.Issuer)
	if err != nil {
		return nil, oauth2.Config{}, ErrProvider
	}
	ep := p.Endpoint()
	if !strings.HasPrefix(ep.AuthURL, "https://") || !strings.HasPrefix(ep.TokenURL, "https://") {
		return nil, oauth2.Config{}, ErrProvider
	}
	secret := ""
	if a.cfg.OIDC.ClientSecretFile != "" {
		b, e := os.ReadFile(a.cfg.OIDC.ClientSecretFile)
		if e != nil {
			return nil, oauth2.Config{}, ErrProvider
		}
		secret = strings.TrimSpace(string(b))
	}
	scopes := append([]string{oidc.ScopeOpenID, "profile"}, a.cfg.OIDC.Scopes...)
	return p, oauth2.Config{ClientID: a.cfg.OIDC.ClientID, ClientSecret: secret, RedirectURL: origin + "/auth/oidc/callback", Endpoint: ep, Scopes: scopes}, nil
}
func (a *Auth) Begin(ctx context.Context, origin string) (string, string, error) {
	_, cfg, err := a.provider(ctx, origin)
	if err != nil {
		return "", "", err
	}
	state, browser, nonce, verifier := token(), token(), token(), oauth2.GenerateVerifier()
	a.mu.Lock()
	defer a.mu.Unlock()
	now := time.Now()
	for k, v := range a.flows {
		if now.After(v.expires) {
			delete(a.flows, k)
		}
	}
	if len(a.flows) >= 256 {
		return "", "", ErrLimited
	}
	a.flows[state] = flow{nonce: nonce, verifier: verifier, origin: origin, browser: digest(browser), expires: now.Add(5 * time.Minute)}
	return cfg.AuthCodeURL(state, oauth2.S256ChallengeOption(verifier), oidc.Nonce(nonce)), browser, nil
}
func (a *Auth) Finish(ctx context.Context, origin, state, browser, code string) (result Session, rawToken string, returnErr error) {
	defer func() {
		if returnErr != nil {
			a.LoginFailure.Add(1)
		}
	}()
	a.mu.Lock()
	f, ok := a.flows[state]
	delete(a.flows, state)
	a.mu.Unlock()
	if !ok || time.Now().After(f.expires) || origin != f.origin || subtle.ConstantTimeCompare([]byte(f.browser), []byte(digest(browser))) != 1 || code == "" {
		return Session{}, "", ErrDenied
	}
	provider, cfg, err := a.provider(ctx, origin)
	if err != nil {
		return Session{}, "", err
	}
	client := &http.Client{Timeout: 8 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}
	if a.httpClient != nil {
		client = a.httpClient
	}
	ctx = oidc.ClientContext(ctx, client)
	exchanged, err := cfg.Exchange(ctx, code, oauth2.VerifierOption(f.verifier))
	if err != nil {
		return Session{}, "", ErrProvider
	}
	raw, ok := exchanged.Extra("id_token").(string)
	if !ok {
		return Session{}, "", ErrDenied
	}
	id, err := provider.Verifier(&oidc.Config{ClientID: a.cfg.OIDC.ClientID}).Verify(ctx, raw)
	if err != nil || id.Subject == "" || subtle.ConstantTimeCompare([]byte(id.Nonce), []byte(f.nonce)) != 1 {
		return Session{}, "", ErrDenied
	}
	var claims map[string]any
	if err = id.Claims(&claims); err != nil {
		return Session{}, "", ErrDenied
	}
	role := a.cfg.OIDC.SubjectRoles[id.Subject]
	if groups, ok := claims[a.cfg.OIDC.GroupClaim].([]any); ok {
		for _, g := range groups {
			if name, ok := g.(string); ok {
				r := a.cfg.OIDC.GroupRoles[name]
				if Can(r, role) || role == "" {
					role = r
				}
			}
		}
	}
	if !Can(role, "viewer") {
		return Session{}, "", ErrDenied
	}
	name, _ := claims["name"].(string)
	if name == "" {
		name = id.Subject
	}
	if len(name) > 256 {
		name = name[:256]
	}
	u := User{ID: "oidc:" + digest(a.cfg.OIDC.Issuer+"\x00"+id.Subject), Name: name, Role: role}
	if err = a.store.Audit(ctx, u.ID, "oidc-login", "success"); err != nil {
		return Session{}, "", err
	}
	return a.create(ctx, u, origin)
}
