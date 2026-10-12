// Package server manages independent listeners and reloadable TLS certificates.
package server

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"log/slog"
	"net"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/ingest"
)

type Listener struct {
	Address string `json:"address"`
	Status  string `json:"status"`
}
type CertStatus struct {
	Names     []string  `json:"names"`
	ExpiresAt time.Time `json:"expires_at"`
	Status    string    `json:"status"`
}
type Runtime struct {
	mu         sync.RWMutex
	certs      []*tls.Certificate
	certStatus []CertStatus
	listeners  []Listener
	servers    []*http.Server
	cfg        config.Config
}

func New(c config.Config) *Runtime {
	return &Runtime{cfg: c, listeners: []Listener{}, certStatus: []CertStatus{}}
}
func (s *Runtime) Reload() error {
	if s.cfg.Fixture {
		return nil
	}
	certs := []*tls.Certificate{}
	status := []CertStatus{}
	for _, paths := range s.cfg.Certificates {
		c, err := tls.LoadX509KeyPair(paths.CertFile, paths.KeyFile)
		if err != nil {
			s.markCertError()
			return err
		}
		leaf, err := x509.ParseCertificate(c.Certificate[0])
		if err != nil {
			s.markCertError()
			return err
		}
		c.Leaf = leaf
		now := time.Now()
		if now.Before(leaf.NotBefore) || now.After(leaf.NotAfter) {
			s.markCertError()
			return errors.New("certificate outside validity period")
		}
		names := append([]string{}, leaf.DNSNames...)
		for _, ip := range leaf.IPAddresses {
			names = append(names, ip.String())
		}
		certs = append(certs, &c)
		status = append(status, CertStatus{Names: names, ExpiresAt: leaf.NotAfter, Status: "current"})
	}
	// Every configured browser origin needs certificate coverage, including IP-based recovery endpoints.
	for _, origin := range s.cfg.Origins {
		host := strings.TrimPrefix(origin, "https://")
		if h, _, err := net.SplitHostPort(host); err == nil {
			host = h
		}
		host = strings.Trim(host, "[]")
		found := false
		for _, c := range certs {
			if c.Leaf.VerifyHostname(host) == nil {
				found = true
			}
		}
		if !found {
			s.markCertError()
			return errors.New("certificate does not cover a configured management origin")
		}
	}
	s.mu.Lock()
	s.certs = certs
	s.certStatus = status
	s.mu.Unlock()
	return nil
}
func (s *Runtime) markCertError() {
	s.mu.Lock()
	defer s.mu.Unlock()
	for i := range s.certStatus {
		s.certStatus[i].Status = "reload_failed"
	}
}
func (s *Runtime) certificate(hello *tls.ClientHelloInfo) (*tls.Certificate, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	name := hello.ServerName
	if name == "" && hello.Conn != nil {
		if host, _, err := net.SplitHostPort(hello.Conn.LocalAddr().String()); err == nil {
			name = host
		}
	}
	for _, c := range s.certs {
		if time.Now().After(c.Leaf.NotAfter) {
			continue
		}
		if name != "" && c.Leaf.VerifyHostname(name) == nil {
			return c, nil
		}
	}
	return nil, errors.New("no matching valid certificate")
}
func (s *Runtime) Snapshot() any {
	s.mu.RLock()
	defer s.mu.RUnlock()
	listeners := append([]Listener{}, s.listeners...)
	certs := append([]CertStatus{}, s.certStatus...)
	return map[string]any{"listeners": listeners, "certificates": certs}
}
func httpServer(h http.Handler) *http.Server {
	return &http.Server{Handler: h, ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 20 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
}
func (s *Runtime) Start(h http.Handler, local *ingest.Server) error {
	if err := s.Reload(); err != nil {
		return err
	}
	count := 0
	for _, address := range s.cfg.Listen {
		l, err := net.Listen("tcp", address)
		status := "listening"
		if err != nil {
			status = "unavailable"
			slog.Warn("management listener unavailable", "address", address)
		}
		s.mu.Lock()
		index := len(s.listeners)
		s.listeners = append(s.listeners, Listener{Address: address, Status: status})
		s.mu.Unlock()
		if err != nil {
			continue
		}
		count++
		httpd := httpServer(h)
		if !s.cfg.Fixture {
			httpd.TLSConfig = &tls.Config{MinVersion: tls.VersionTLS13, GetCertificate: s.certificate}
			l = tls.NewListener(l, httpd.TLSConfig)
		}
		s.servers = append(s.servers, httpd)
		go func() {
			err := httpd.Serve(l)
			if err != nil && !errors.Is(err, http.ErrServerClosed) {
				s.mu.Lock()
				s.listeners[index].Status = "failed"
				s.mu.Unlock()
				slog.Error("management listener stopped", "address", address)
			}
		}()
	}
	if count == 0 {
		return errors.New("no management listener could start")
	}
	l, err := ingest.Listen(s.cfg.IngestSocket)
	if err != nil {
		s.Close(context.Background())
		return err
	}
	httpd := httpServer(local.Handler())
	httpd.ConnContext = ingest.PeerContext
	s.servers = append(s.servers, httpd)
	go func() {
		if err := httpd.Serve(l); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("local ingestion stopped")
		}
	}()
	return nil
}
func (s *Runtime) Close(ctx context.Context) error {
	var errs []error
	for _, httpd := range s.servers {
		errs = append(errs, httpd.Shutdown(ctx))
	}
	return errors.Join(errs...)
}
