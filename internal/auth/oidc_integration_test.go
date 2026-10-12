//go:build integration

package auth

import (
	"context"
	"crypto"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"math/big"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
)

func TestOIDCProtocolVerification(t *testing.T) {
	key, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		t.Fatal(err)
	}
	a, _ := authTest(t)
	var issuer, nonce, challenge, variant string
	provider := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		switch r.URL.Path {
		case "/.well-known/openid-configuration":
			json.NewEncoder(w).Encode(map[string]any{"issuer": issuer, "authorization_endpoint": issuer + "/authorize", "token_endpoint": issuer + "/token", "jwks_uri": issuer + "/jwks", "id_token_signing_alg_values_supported": []string{"RS256"}})
		case "/jwks":
			json.NewEncoder(w).Encode(map[string]any{"keys": []any{map[string]any{"kty": "RSA", "kid": "test-key", "use": "sig", "alg": "RS256", "n": base64.RawURLEncoding.EncodeToString(key.N.Bytes()), "e": base64.RawURLEncoding.EncodeToString(big.NewInt(int64(key.E)).Bytes())}}})
		case "/token":
			if err := r.ParseForm(); err != nil {
				t.Error(err)
			}
			h := sha256.Sum256([]byte(r.Form.Get("code_verifier")))
			if base64.RawURLEncoding.EncodeToString(h[:]) != challenge {
				t.Error("PKCE verifier does not match challenge")
			}
			claims := map[string]any{"iss": issuer, "aud": "console-client", "sub": "subject-1", "exp": time.Now().Add(time.Minute).Unix(), "iat": time.Now().Unix(), "nonce": nonce, "name": "Example user", "groups": []string{"observers"}}
			switch variant {
			case "issuer":
				claims["iss"] = "https://untrusted.example"
			case "audience":
				claims["aud"] = "other-client"
			case "expiry":
				claims["exp"] = time.Now().Add(-10 * time.Minute).Unix()
			case "nonce":
				claims["nonce"] = "wrong"
			case "unmapped":
				claims["groups"] = []string{"unmapped"}
			}
			header, _ := json.Marshal(map[string]string{"alg": "RS256", "kid": "test-key"})
			payload, _ := json.Marshal(claims)
			signed := base64.RawURLEncoding.EncodeToString(header) + "." + base64.RawURLEncoding.EncodeToString(payload)
			digest := sha256.Sum256([]byte(signed))
			sig, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA256, digest[:])
			if err != nil {
				t.Error(err)
			}
			if variant == "signature" {
				sig[0] ^= 1
			}
			jwt := signed + "." + base64.RawURLEncoding.EncodeToString(sig)
			json.NewEncoder(w).Encode(map[string]any{"access_token": "never-stored", "token_type": "Bearer", "expires_in": 60, "id_token": jwt})
		default:
			http.NotFound(w, r)
		}
	}))
	defer provider.Close()
	issuer = provider.URL
	a.httpClient = provider.Client()
	a.cfg.OIDC = config.OIDC{Issuer: issuer, ClientID: "console-client", GroupClaim: "groups", GroupRoles: map[string]string{"observers": "viewer"}}
	for _, name := range []string{"valid", "issuer", "audience", "expiry", "nonce", "signature", "unmapped"} {
		t.Run(name, func(t *testing.T) {
			variant = name
			target, browser, err := a.Begin(context.Background(), "https://router.example")
			if err != nil {
				t.Fatal(err)
			}
			u, err := url.Parse(target)
			if err != nil {
				t.Fatal(err)
			}
			nonce = u.Query().Get("nonce")
			challenge = u.Query().Get("code_challenge")
			if challenge == "" || u.Query().Get("code_challenge_method") != "S256" || u.Query().Get("redirect_uri") != "https://router.example/auth/oidc/callback" {
				t.Fatal("invalid PKCE or callback")
			}
			session, raw, err := a.Finish(context.Background(), "https://router.example", u.Query().Get("state"), browser, "code")
			if name == "valid" {
				if err != nil || session.User.Role != "viewer" || !strings.HasPrefix(session.User.ID, "oidc:") {
					t.Fatalf("valid login rejected: %+v %v", session, err)
				}
				if _, err = a.Resolve(context.Background(), raw, "https://router.example"); err != nil {
					t.Fatal(err)
				}
			} else if err == nil {
				t.Fatalf("invalid %s accepted", name)
			}
			if _, _, err = a.Finish(context.Background(), "https://router.example", u.Query().Get("state"), browser, "code"); err == nil {
				t.Fatal("replayed login accepted")
			}
		})
	}
}
