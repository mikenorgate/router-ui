// Package httpapi serves authenticated observation APIs and locally bundled frontend assets.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/mikenorgate/router-ui/internal/auth"
	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/fixture"
	"github.com/mikenorgate/router-ui/internal/metrics"
	"github.com/mikenorgate/router-ui/internal/model"
	"github.com/mikenorgate/router-ui/internal/store"
)

type sessionKey struct{}
type originKey struct{}
type API struct {
	Store   *store.Store
	Auth    *auth.Auth
	Config  config.Config
	Version string
	Runtime func() any
	Metrics *metrics.Client
	slots   chan struct{}
}

func New(s *store.Store, a *auth.Auth, c config.Config, version string) *API {
	return &API{Store: s, Auth: a, Config: c, Version: version, Metrics: metrics.New(c), slots: make(chan struct{}, 16)}
}
func output(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(data)
}
func problem(w http.ResponseWriter, status int, code, message string) {
	output(w, status, map[string]any{"error": map[string]string{"code": code, "message": message}})
}
func decode(w http.ResponseWriter, r *http.Request, v any) bool {
	r.Body = http.MaxBytesReader(w, r.Body, 8192)
	defer r.Body.Close()
	d := json.NewDecoder(r.Body)
	d.DisallowUnknownFields()
	if err := d.Decode(v); err != nil {
		problem(w, 400, "invalid_request", "Invalid request body")
		return false
	}
	var extra any
	if d.Decode(&extra) != io.EOF {
		problem(w, 400, "invalid_request", "One JSON object required")
		return false
	}
	return true
}
func (a *API) origin(r *http.Request) string {
	scheme := "http"
	if r.TLS != nil {
		scheme = "https"
	}
	candidate := scheme + "://" + r.Host
	for _, origin := range a.Config.Origins {
		if strings.EqualFold(candidate, origin) {
			return origin
		}
	}
	return ""
}
func (a *API) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /api/v1/auth/methods", func(w http.ResponseWriter, r *http.Request) {
		output(w, 200, map[string]any{"local": true, "oidc": map[string]any{"enabled": a.Config.OIDC.Issuer != "", "name": a.Config.OIDC.Name, "login_url": "/auth/oidc/login"}})
	})
	mux.HandleFunc("POST /api/v1/auth/login", a.login)
	mux.HandleFunc("GET /auth/oidc/login", a.oidcBegin)
	mux.HandleFunc("GET /auth/oidc/callback", a.oidcFinish)
	mux.Handle("GET /api/v1/session", a.protect("viewer", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { output(w, 200, session(r)) })))
	mux.Handle("POST /api/v1/auth/logout", a.protect("viewer", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, _ := r.Cookie(a.Auth.CookieName())
		if err := a.Auth.Revoke(r.Context(), c.Value); err != nil {
			problem(w, 503, "unavailable", "Session could not be revoked")
			return
		}
		a.Auth.Cookie(w, "")
		output(w, 200, map[string]bool{"ok": true})
	})))
	mux.Handle("GET /api/v1/overview", a.protect("viewer", http.HandlerFunc(a.overview)))
	mux.Handle("GET /api/v1/devices", a.protect("viewer", a.collection("device")))
	mux.Handle("GET /api/v1/devices/{id}", a.protect("viewer", http.HandlerFunc(a.device)))
	mux.Handle("POST /api/v1/devices/{id}/annotation", a.protect("operator", http.HandlerFunc(a.annotation)))
	mux.Handle("GET /api/v1/flows", a.protect("operator", a.collection("flow")))
	mux.Handle("GET /api/v1/dns", a.protect("operator", a.collection("dns")))
	mux.Handle("GET /api/v1/policies", a.protect("viewer", http.HandlerFunc(a.policies)))
	mux.Handle("GET /api/v1/events", a.protect("viewer", a.collection("event")))
	mux.Handle("GET /api/v1/summaries", a.protect("viewer", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q, err := query(r)
		if err != nil {
			problem(w, 400, "invalid_query", err.Error())
			return
		}
		items, err := a.Store.Summaries(r.Context(), q)
		if err != nil {
			problem(w, 503, "unavailable", "Summaries unavailable")
			return
		}
		output(w, 200, map[string]any{"items": items})
	})))
	mux.Handle("GET /api/v1/policies/{id}/history", a.protect("viewer", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.PathValue("id")
		if !model.Identifier(id) {
			problem(w, 400, "invalid_rule", "Invalid rule ID")
			return
		}
		items, err := a.Store.Query(r.Context(), "policy", store.Query{History: true, RecordID: id, Limit: 100})
		if err != nil {
			problem(w, 503, "unavailable", "Policy history unavailable")
			return
		}
		output(w, 200, map[string]any{"items": items})
	})))
	mux.Handle("GET /api/v1/network", a.protect("viewer", http.HandlerFunc(a.network)))
	mux.Handle("GET /api/v1/system", a.protect("viewer", http.HandlerFunc(a.system)))
	mux.Handle("GET /api/v1/export", a.protect("operator", http.HandlerFunc(a.export)))
	mux.Handle("GET /api/v1/admin/audit", a.protect("admin", http.HandlerFunc(a.audit)))
	mux.Handle("POST /api/v1/admin/retention", a.protect("admin", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var body struct {
			RawDays     int `json:"raw_days"`
			HistoryDays int `json:"history_days"`
		}
		if !decode(w, r, &body) {
			return
		}
		if err := a.Store.SetRetention(r.Context(), body.RawDays, body.HistoryDays, session(r).User.ID); err != nil {
			status := 503
			if errors.Is(err, store.ErrRetention) {
				status = 400
			}
			problem(w, status, "retention_rejected", err.Error())
			return
		}
		output(w, 200, map[string]any{"raw_days": body.RawDays, "history_days": body.HistoryDays, "message": "Retention updated; maintenance applies the change. Deleted observations cannot be restored."})
	})))
	mux.Handle("POST /api/v1/admin/revoke-sessions", a.protect("admin", http.HandlerFunc(a.revokeSessions)))
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) { problem(w, 404, "not_found", "Unknown API endpoint") })
	mux.HandleFunc("/", a.static)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
			w.Header().Set("Cache-Control", "no-store")
		}
		w.Header().Set("X-Content-Type-Options", "nosniff")
		w.Header().Set("Referrer-Policy", "no-referrer")
		w.Header().Set("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'")
		w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=()")
		if !a.Config.Fixture {
			w.Header().Set("Strict-Transport-Security", "max-age=31536000")
		}
		origin := a.origin(r)
		if origin == "" {
			problem(w, 421, "origin_not_allowed", "Use a configured management address")
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" {
			if r.Header.Get("Origin") != origin {
				problem(w, 403, "origin_not_allowed", "Request origin is not allowed")
				return
			}
			if !strings.HasPrefix(r.Header.Get("Content-Type"), "application/json") {
				problem(w, 415, "content_type", "JSON required")
				return
			}
		}
		if strings.HasPrefix(r.URL.Path, "/api/") || strings.HasPrefix(r.URL.Path, "/auth/") {
			w.Header().Set("Cache-Control", "no-store")
			select {
			case a.slots <- struct{}{}:
				defer func() { <-a.slots }()
			default:
				problem(w, 503, "busy", "Console busy; retry shortly")
				return
			}
		}
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		defer cancel()
		ctx = context.WithValue(ctx, originKey{}, origin)
		mux.ServeHTTP(w, r.WithContext(ctx))
	})
}
func session(r *http.Request) auth.Session {
	v, _ := r.Context().Value(sessionKey{}).(auth.Session)
	return v
}
func (a *API) protect(role string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		c, err := r.Cookie(a.Auth.CookieName())
		if err != nil {
			problem(w, 401, "unauthenticated", "Sign in to continue")
			return
		}
		origin, _ := r.Context().Value(originKey{}).(string)
		s, err := a.Auth.Resolve(r.Context(), c.Value, origin)
		if err != nil {
			problem(w, 401, "unauthenticated", "Session expired; sign in again")
			return
		}
		if !auth.Can(s.User.Role, role) {
			problem(w, 403, "forbidden", "This account cannot access detailed traffic or this action")
			return
		}
		if r.Method != "GET" && r.Method != "HEAD" && !auth.CSRF(s, r.Header.Get("X-CSRF-Token")) {
			problem(w, 403, "csrf", "Refresh the page and retry")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), sessionKey{}, s)))
	})
}
func (a *API) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Username string `json:"username"`
		Password string `json:"password"`
	}
	if !decode(w, r, &body) {
		return
	}
	ip, _, _ := net.SplitHostPort(r.RemoteAddr)
	origin, _ := r.Context().Value(originKey{}).(string)
	s, raw, err := a.Auth.Local(r.Context(), body.Username, body.Password, ip, origin)
	if err != nil {
		status := 401
		code := "invalid_credentials"
		message := "Invalid username or password"
		if errors.Is(err, auth.ErrLimited) {
			status = 429
			code = "rate_limited"
			message = "Too many attempts; try again in five minutes"
			w.Header().Set("Retry-After", "300")
		} else if !errors.Is(err, auth.ErrDenied) {
			status = 503
			code = "unavailable"
			message = "Local authentication is unavailable"
		}
		problem(w, status, code, message)
		return
	}
	a.Auth.Cookie(w, raw)
	output(w, 200, s)
}
func (a *API) oidcBegin(w http.ResponseWriter, r *http.Request) {
	origin, _ := r.Context().Value(originKey{}).(string)
	target, browser, err := a.Auth.Begin(r.Context(), origin)
	if err != nil {
		http.Redirect(w, r, "/login?error=provider_unavailable", http.StatusSeeOther)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: "router_console_oidc", Value: browser, Path: "/auth/oidc", Secure: !a.Config.Fixture, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: 300})
	http.Redirect(w, r, target, http.StatusFound)
}
func (a *API) oidcFinish(w http.ResponseWriter, r *http.Request) {
	c, err := r.Cookie("router_console_oidc")
	if err != nil {
		http.Redirect(w, r, "/login?error=invalid_login", http.StatusSeeOther)
		return
	}
	http.SetCookie(w, &http.Cookie{Name: c.Name, Value: "", Path: "/auth/oidc", Secure: !a.Config.Fixture, HttpOnly: true, SameSite: http.SameSiteLaxMode, MaxAge: -1})
	origin, _ := r.Context().Value(originKey{}).(string)
	s, raw, err := a.Auth.Finish(r.Context(), origin, r.URL.Query().Get("state"), c.Value, r.URL.Query().Get("code"))
	if err != nil {
		_ = a.Store.Audit(r.Context(), "oidc-login", "login", "denied")
		http.Redirect(w, r, "/login?error=invalid_login", http.StatusSeeOther)
		return
	}
	_ = s
	a.Auth.Cookie(w, raw)
	http.Redirect(w, r, "/overview", http.StatusSeeOther)
}
func query(r *http.Request) (store.Query, error) {
	q := r.URL.Query()
	limit := 100
	offset := 0
	var err error
	if q.Get("limit") != "" {
		limit, err = strconv.Atoi(q.Get("limit"))
		if err != nil || limit < 1 || limit > 500 {
			return store.Query{}, errors.New("limit must be 1–500")
		}
	}
	if q.Get("cursor") != "" {
		offset, err = strconv.Atoi(q.Get("cursor"))
		if err != nil || offset < 0 || offset > 10000 {
			return store.Query{}, errors.New("invalid cursor")
		}
	}
	out := store.Query{Q: q.Get("q"), DeviceID: q.Get("device_id"), Limit: limit, Offset: offset}
	out.Verdict = q.Get("verdict")
	out.Protocol = strings.ToUpper(q.Get("protocol"))
	out.Family = q.Get("family")
	out.Translation = q.Get("translation")
	for key, allowed := range map[string][]string{"verdict": {"", "allowed", "blocked", "unknown"}, "protocol": {"", "TCP", "UDP", "ICMP", "ICMPV6", "SCTP"}, "family": {"", "4", "6"}, "translation": {"", "recorded", "unrecorded"}} {
		value := q.Get(key)
		if key == "protocol" {
			value = strings.ToUpper(value)
		}
		valid := false
		for _, option := range allowed {
			if value == option {
				valid = true
			}
		}
		if !valid {
			return out, errors.New("unsupported traffic filter")
		}
	}
	for k, p := range map[string]*time.Time{"from": &out.From, "to": &out.To} {
		if q.Get(k) != "" {
			*p, err = time.Parse(time.RFC3339, q.Get(k))
			if err != nil {
				return out, err
			}
		}
	}
	if out.From.IsZero() && q.Get("range") != "" {
		span := time.Hour
		switch q.Get("range") {
		case "15m":
			span = 15 * time.Minute
		case "1h":
		case "24h":
			span = 24 * time.Hour
		case "7d":
			span = 7 * 24 * time.Hour
		default:
			return out, errors.New("unsupported range")
		}
		out.To = time.Now().UTC()
		out.From = out.To.Add(-span)
	}
	if len(out.Q) > 128 || out.DeviceID != "" && !model.Identifier(out.DeviceID) || !out.From.IsZero() && !out.To.IsZero() && out.To.Before(out.From) {
		return out, errors.New("invalid query bounds")
	}
	return out, nil
}
func (a *API) collection(kind string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		q, err := query(r)
		if err != nil {
			problem(w, 400, "invalid_query", err.Error())
			return
		}
		items, err := a.Store.Query(r.Context(), kind, q)
		if err != nil {
			problem(w, 503, "unavailable", "History unavailable")
			return
		}
		body := map[string]any{"items": items, "capabilities": a.capabilities()}
		if kind == "event" {
			redacted, err := summaryEvents(items, session(r).User.Role)
			if err != nil {
				problem(w, 503, "unavailable", "Events invalid")
				return
			}
			body["items"] = redacted
		}
		if kind == "device" {
			sources, err := a.sources(r.Context())
			if err != nil {
				problem(w, 503, "unavailable", "Sources unavailable")
				return
			}
			views := []deviceResponse{}
			for _, raw := range items {
				var d model.Device
				if err = json.Unmarshal(raw, &d); err != nil {
					problem(w, 503, "unavailable", "Device record invalid")
					return
				}
				v, err := a.deviceView(r.Context(), d, sources)
				if err != nil {
					problem(w, 503, "unavailable", "Annotation unavailable")
					return
				}
				views = append(views, v)
			}
			body["items"] = views
		}
		if len(items) == q.Limit && q.Offset+q.Limit <= 10000 {
			body["next_cursor"] = strconv.Itoa(q.Offset + q.Limit)
		}
		output(w, 200, body)
	})
}
func (a *API) device(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	if !model.Identifier(id) {
		problem(w, 400, "invalid_device", "Invalid device ID")
		return
	}
	items, err := a.Store.Query(r.Context(), "device", store.Query{DeviceID: id, Limit: 1})
	if err != nil {
		problem(w, 503, "unavailable", "Device history unavailable")
		return
	}
	if len(items) == 0 {
		problem(w, 404, "not_found", "Device not observed")
		return
	}
	var device model.Device
	if err = json.Unmarshal(items[0], &device); err != nil {
		problem(w, 503, "unavailable", "Device record invalid")
		return
	}
	bindings := append([]model.Address{}, device.Addresses...)
	snapshots, err := a.Store.Query(r.Context(), "device", store.Query{History: true, DeviceID: id, Limit: 100})
	if err != nil {
		problem(w, 503, "unavailable", "Binding history unavailable")
		return
	}
	seen := map[string]bool{}
	for _, b := range bindings {
		seen[b.Address+b.ValidFrom.String()+b.Source] = true
	}
	for _, b := range snapshots {
		var v model.Device
		if err = json.Unmarshal(b, &v); err != nil {
			problem(w, 503, "unavailable", "Binding history invalid")
			return
		}
		for _, address := range v.Addresses {
			key := address.Address + address.ValidFrom.String() + address.Source
			if !seen[key] && len(bindings) < 500 {
				bindings = append(bindings, address)
				seen[key] = true
			}
		}
	}
	flows := []json.RawMessage{}
	if auth.Can(session(r).User.Role, "operator") {
		flows, err = a.Store.Query(r.Context(), "flow", store.Query{DeviceID: id, Limit: 100})
		if err != nil {
			problem(w, 503, "unavailable", "Traffic unavailable")
			return
		}
	}
	events, err := a.Store.Query(r.Context(), "event", store.Query{DeviceID: id, Limit: 100})
	if err != nil {
		problem(w, 503, "unavailable", "Events unavailable")
		return
	}
	policies, err := a.devicePolicies(r.Context(), id)
	if err != nil {
		problem(w, 503, "unavailable", "Policy unavailable")
		return
	}
	events, err = summaryEvents(events, session(r).User.Role)
	if err != nil {
		problem(w, 503, "unavailable", "Events invalid")
		return
	}
	note, err := a.Store.Annotation(r.Context(), id)
	if err != nil {
		problem(w, 503, "unavailable", "Annotation unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Sources unavailable")
		return
	}
	view, err := a.deviceView(r.Context(), device, sources)
	if err != nil {
		problem(w, 503, "unavailable", "Annotation unavailable")
		return
	}
	body := map[string]any{"device": view, "bindings": bindings, "flows": flows, "events": events, "policies": policies, "policy_sources": policySources(sources), "annotation": note, "detail_restricted": !auth.Can(session(r).User.Role, "operator")}
	if len(policies) == 100 {
		body["policies_next_cursor"] = "100"
	}
	output(w, 200, body)
}
func (a *API) devicePolicies(ctx context.Context, id string) ([]model.Policy, error) {
	return a.Store.PolicyViews(ctx, store.Query{DeviceID: id, Limit: 100})
}
func (a *API) policies(w http.ResponseWriter, r *http.Request) {
	q, err := query(r)
	if err != nil {
		problem(w, 400, "invalid_query", err.Error())
		return
	}
	q.Evidence = r.URL.Query().Get("evidence")
	switch q.Evidence {
	case "", "installed", "applicable", "observed", "unknown":
	default:
		problem(w, 400, "invalid_query", "Unsupported policy evidence")
		return
	}
	items, err := a.Store.PolicyViews(r.Context(), q)
	if err != nil {
		problem(w, 503, "unavailable", "Policy unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Policy sources unavailable")
		return
	}
	body := map[string]any{"items": items, "sources": policySources(sources)}
	if len(items) == q.Limit && q.Offset+q.Limit <= 10000 {
		body["next_cursor"] = strconv.Itoa(q.Offset + q.Limit)
	}
	output(w, 200, body)
}

// policySources returns only sources that can supply policy evidence.
func policySources(sources []model.Source) []model.Source {
	out := []model.Source{}
	for _, source := range sources {
		if source.Scope == "policies" {
			out = append(out, source)
			continue
		}
		for _, kind := range strings.Split(source.Kind, ",") {
			if kind == "policy" || kind == "rule" || kind == "application" {
				out = append(out, source)
				break
			}
		}
	}
	return out
}

func (a *API) annotation(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	devices, err := a.Store.Query(r.Context(), "device", store.Query{DeviceID: id, Limit: 1})
	if err != nil {
		problem(w, 503, "unavailable", "Inventory unavailable")
		return
	}
	if len(devices) == 0 {
		problem(w, 404, "not_found", "Annotate an observed device")
		return
	}
	var note store.Annotation
	if !decode(w, r, &note) {
		return
	}
	if err := a.Store.Annotate(r.Context(), id, note); err != nil {
		problem(w, 400, "invalid_annotation", "Alias or note exceeds limits")
		return
	}
	if err := a.Store.Audit(r.Context(), session(r).User.ID, "device-annotation", "success"); err != nil {
		problem(w, 503, "audit_unavailable", "Annotation saved but audit could not be recorded")
		return
	}
	output(w, 200, note)
}
func (a *API) overview(w http.ResponseWriter, r *http.Request) {
	span := time.Hour
	switch r.URL.Query().Get("range") {
	case "", "1h":
	case "15m":
		span = 15 * time.Minute
	case "24h":
		span = 24 * time.Hour
	case "7d":
		span = 7 * 24 * time.Hour
	default:
		problem(w, 400, "invalid_range", "Choose 15m, 1h, 24h or 7d")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Sources unavailable")
		return
	}
	to := time.Now().UTC()
	from := to.Add(-span)
	if r.URL.Query().Has("from") || r.URL.Query().Has("to") {
		var err error
		from, err = time.Parse(time.RFC3339, r.URL.Query().Get("from"))
		if err != nil {
			problem(w, 400, "invalid_range", "A fixed interval requires from and to")
			return
		}
		to, err = time.Parse(time.RFC3339, r.URL.Query().Get("to"))
		if err != nil || !to.After(from) || to.Sub(from) > 7*24*time.Hour || from.Before(time.Now().AddDate(0, 0, -90)) || to.After(time.Now().Add(5*time.Minute)) {
			problem(w, 400, "invalid_range", "Choose an interval of at most seven days within retained history")
			return
		}
	}
	events, err := a.Store.Query(r.Context(), "event", store.Query{Limit: 20, From: from, To: to})
	if err != nil {
		problem(w, 503, "unavailable", "Events unavailable")
		return
	}
	metricsCtx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	m, s := a.Metrics.Range(metricsCtx, from, to)
	cancel()
	events, err = summaryEvents(events, session(r).User.Role)
	if err != nil {
		problem(w, 503, "unavailable", "Events invalid")
		return
	}
	if a.Config.Fixture {
		m, s = fixture.Metrics(span)
	}
	total, active, err := a.Store.DeviceCounts(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Inventory counts unavailable")
		return
	}
	count, err := a.Store.FlowCountRange(r.Context(), from, to)
	if err != nil {
		problem(w, 503, "unavailable", "Summary unavailable")
		return
	}
	output(w, 200, map[string]any{"metrics": m, "series": s, "devices_total": total, "active_devices": active, "flows_total": count, "capabilities": a.capabilities(), "events": events, "sources": sources})
}
func (a *API) network(w http.ResponseWriter, r *http.Request) {
	items, err := a.Store.Query(r.Context(), "network", store.Query{Limit: 1})
	if err != nil {
		problem(w, 503, "unavailable", "Network snapshot unavailable")
		return
	}
	if len(items) == 0 {
		output(w, 200, model.Network{Interfaces: []map[string]any{}, Segments: []map[string]any{}, Routes: []map[string]any{}, CoverageNotes: []string{"No router-owned network source has supplied a snapshot. Physical switch ports and wireless topology are not inferred."}})
		return
	}
	output(w, 200, items[0])
}
func (a *API) sources(ctx context.Context) ([]model.Source, error) {
	observed, err := a.Store.Sources(ctx, time.Now())
	if err != nil {
		return nil, err
	}
	seen := map[string]bool{}
	for _, s := range observed {
		seen[s.ID] = true
	}
	for _, p := range a.Config.Producers {
		if !seen[p.ID] {
			observed = append(observed, model.Source{ID: p.ID, Kind: strings.Join(p.Kinds, ","), Status: "missing", Coverage: "Configured producer has not supplied observations"})
		}
	}
	return observed, nil
}
func (a *API) system(w http.ResponseWriter, r *http.Request) {
	stats, err := a.Store.Stats(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Storage unavailable")
		return
	}
	sources, err := a.sources(r.Context())
	if err != nil {
		problem(w, 503, "unavailable", "Sources unavailable")
		return
	}
	caps := a.capabilities()
	runtime := map[string]any{}
	if a.Runtime != nil {
		if v, ok := a.Runtime().(map[string]any); ok {
			runtime = v
		}
	}
	listeners := runtime["listeners"]
	if listeners == nil {
		listeners = []any{}
	}
	certs := runtime["certificates"]
	if certs == nil {
		certs = []any{}
	}
	appliances, err := a.Store.Query(r.Context(), "appliance", store.Query{Limit: 1})
	if err != nil {
		problem(w, 503, "unavailable", "Appliance observation unavailable")
		return
	}
	var appliance any
	if len(appliances) > 0 {
		appliance = appliances[0]
	}
	output(w, 200, map[string]any{"appliance": appliance, "ingestion_contract": 2, "state_schema": 1, "history_schema": store.HistorySchemaVersion, "version": a.Version, "mode": session(r).Mode, "capabilities": caps, "sources": sources, "storage": stats, "listeners": listeners, "certificates": certs, "auth": map[string]bool{"oidc_enabled": a.Config.OIDC.Issuer != "", "local_recovery": true}})
}
func (a *API) export(w http.ResponseWriter, r *http.Request) {
	kind := r.URL.Query().Get("kind")
	if kind != "flows" && kind != "dns" {
		problem(w, 400, "invalid_export", "Choose flows or dns")
		return
	}
	q, err := query(r)
	if err != nil {
		problem(w, 400, "invalid_query", err.Error())
		return
	}
	q.Limit = 500
	internalKind := "flow"
	if kind == "dns" {
		internalKind = "dns"
	}
	items, err := a.Store.Query(r.Context(), internalKind, q)
	if err != nil {
		problem(w, 503, "unavailable", "Export unavailable")
		return
	}
	if err = a.Store.Audit(r.Context(), session(r).User.ID, "export-"+kind, "success"); err != nil {
		problem(w, 503, "unavailable", "Export audit unavailable")
		return
	}
	w.Header().Set("Content-Disposition", fmt.Sprintf("attachment; filename=router-console-%s.json", kind))
	output(w, 200, map[string]any{"items": items, "bounded": true, "limit": 500, "exported_at": time.Now().UTC()})
}
func (a *API) audit(w http.ResponseWriter, r *http.Request) {
	rows, err := a.Store.State.QueryContext(r.Context(), "SELECT time,actor,action,result FROM audits ORDER BY id DESC LIMIT 100")
	if err != nil {
		problem(w, 503, "unavailable", "Audit unavailable")
		return
	}
	defer rows.Close()
	items := []map[string]any{}
	for rows.Next() {
		var when int64
		var actor, action, result string
		if err = rows.Scan(&when, &actor, &action, &result); err != nil {
			problem(w, 503, "unavailable", "Audit unavailable")
			return
		}
		items = append(items, map[string]any{"time": time.Unix(when, 0), "actor": actor, "action": action, "result": result})
	}
	if rows.Err() != nil {
		problem(w, 503, "unavailable", "Audit unavailable")
		return
	}
	output(w, 200, map[string]any{"items": items})
}
func (a *API) revokeSessions(w http.ResponseWriter, r *http.Request) {
	if _, err := a.Store.State.ExecContext(r.Context(), "DELETE FROM sessions"); err != nil {
		problem(w, 503, "unavailable", "Session revocation unavailable")
		return
	}
	a.Auth.Cookie(w, "")
	_ = a.Store.Audit(r.Context(), session(r).User.ID, "revoke-all-sessions", "success")
	output(w, 200, map[string]bool{"ok": true})
}
func (a *API) static(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" && r.Method != "HEAD" {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	clean := filepath.Clean("/" + r.URL.Path)
	path := filepath.Join(a.Config.WebDir, clean)
	f, err := os.Stat(path)
	if err != nil || f.IsDir() {
		if strings.Contains(filepath.Base(clean), ".") {
			http.NotFound(w, r)
			return
		}
		path = filepath.Join(a.Config.WebDir, "index.html")
	}
	if strings.Contains(clean, "/assets/") {
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
	} else {
		w.Header().Set("Cache-Control", "no-cache")
	}
	http.ServeFile(w, r, path)
}

func (a *API) capabilities() []map[string]any {
	caps := []map[string]any{}
	for _, kind := range []string{"device", "flow", "dns", "policy", "network", "event"} {
		supported := false
		for _, p := range a.Config.Producers {
			for _, k := range p.Kinds {
				if k == kind || kind == "policy" && (k == "rule" || k == "application") {
					supported = true
				}
			}
		}
		caps = append(caps, map[string]any{"id": kind, "supported": supported, "reason": "Availability depends on router-owned producer coverage and freshness"})
	}
	return caps
}
