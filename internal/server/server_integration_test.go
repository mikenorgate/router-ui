//go:build integration

package server

import (
	"context"
	"crypto/rand"
	"crypto/rsa"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"errors"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"testing"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
	"github.com/mikenorgate/router-ui/internal/ingest"
	"github.com/mikenorgate/router-ui/internal/store"
)

func TestPartialListenerFailureAndCertificateReload(t *testing.T) {
	d := t.TempDir()
	s, err := store.Open(filepath.Join(d, "state"), filepath.Join(d, "history"), 32<<20, 8<<20, 7, 90)
	if err != nil {
		t.Fatal(err)
	}
	defer s.Close()
	occupied, err := net.Listen("tcp6", "[::1]:0")
	if err != nil {
		t.Fatal(err)
	}
	defer occupied.Close()
	available, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	address := available.Addr().String()
	available.Close()
	certPath, keyPath := filepath.Join(d, "cert.pem"), filepath.Join(d, "key.pem")
	writeCert := func(serial int64) {
		t.Helper()
		key, err := rsa.GenerateKey(rand.Reader, 2048)
		if err != nil {
			t.Fatal(err)
		}
		template := x509.Certificate{SerialNumber: big.NewInt(serial), Subject: pkix.Name{CommonName: "localhost"}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), IPAddresses: []net.IP{net.ParseIP("127.0.0.1"), net.ParseIP("::1")}, DNSNames: []string{"localhost"}, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
		der, err := x509.CreateCertificate(rand.Reader, &template, &template, &key.PublicKey, key)
		if err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(certPath, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der}), 0600); err != nil {
			t.Fatal(err)
		}
		if err = os.WriteFile(keyPath, pem.EncodeToMemory(&pem.Block{Type: "RSA PRIVATE KEY", Bytes: x509.MarshalPKCS1PrivateKey(key)}), 0600); err != nil {
			t.Fatal(err)
		}
	}
	writeCert(1)
	cfg := config.Config{Listen: []string{occupied.Addr().String(), address}, Origins: []string{"https://" + address}, Certificates: []config.Certificate{{CertFile: certPath, KeyFile: keyPath}}, IngestSocket: filepath.Join(d, "ingest.sock")}
	runtime := New(cfg)
	runtime.retryEvery = 10 * time.Millisecond
	if err = runtime.Start(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { w.Write([]byte("ok")) }), ingest.New(s, nil)); err != nil {
		t.Fatal(err)
	}
	defer runtime.Close(context.Background())
	snapshot := runtime.Snapshot().(map[string]any)["listeners"].([]Listener)
	if snapshot[0].Status != "unavailable" || snapshot[1].Status != "listening" {
		t.Fatalf("partial listener failure not visible: %+v", snapshot)
	}
	// Test trust is scoped to this local self-signed fixture; production never skips verification.
	client := http.Client{Transport: &http.Transport{TLSClientConfig: &tls.Config{InsecureSkipVerify: true, MinVersion: tls.VersionTLS13}}, Timeout: 3 * time.Second}
	check := func(serial int64) {
		t.Helper()
		client.CloseIdleConnections()
		response, err := client.Get("https://" + address)
		if err != nil {
			t.Fatal(err)
		}
		defer response.Body.Close()
		if response.TLS.PeerCertificates[0].SerialNumber.Int64() != serial {
			t.Fatal("certificate was not atomically reloaded")
		}
	}
	check(1)
	// Releasing a delayed endpoint must make it available without restarting
	// the runtime or interrupting the endpoint that already serves requests.
	if err = occupied.Close(); err != nil {
		t.Fatal(err)
	}
	deadline := time.Now().Add(3 * time.Second)
	for runtime.Snapshot().(map[string]any)["listeners"].([]Listener)[0].Status != "listening" {
		if time.Now().After(deadline) {
			t.Fatal("delayed listener never recovered")
		}
		time.Sleep(5 * time.Millisecond)
	}
	response, err := client.Get("https://" + cfg.Listen[0])
	if err != nil {
		t.Fatal(err)
	}
	response.Body.Close()
	if response.TLS.PeerCertificates[0].SerialNumber.Int64() != 1 {
		t.Fatal("recovered listener did not use the valid certificate")
	}
	check(1)
	writeCert(2)
	if err = runtime.Reload(); err != nil {
		t.Fatal(err)
	}
	check(2)
	if err = os.WriteFile(keyPath, []byte("invalid"), 0600); err != nil {
		t.Fatal(err)
	}
	if err = runtime.Reload(); err == nil {
		t.Fatal("invalid certificate accepted")
	}
	check(2)
	client.CloseIdleConnections()
}

func TestListenerRetryStopsAtShutdown(t *testing.T) {
	for _, host := range []string{"127.0.0.1", "::1"} {
		t.Run(host, func(t *testing.T) {
			occupied, err := net.Listen("tcp", net.JoinHostPort(host, "0"))
			if err != nil {
				t.Fatal(err)
			}
			defer occupied.Close()
			available, err := net.Listen("tcp", "127.0.0.1:0")
			if err != nil {
				t.Fatal(err)
			}
			address := available.Addr().String()
			available.Close()
			cfg := config.Config{Fixture: true, Listen: []string{address, occupied.Addr().String()}, IngestSocket: filepath.Join(t.TempDir(), "ingest.sock")}
			runtime := New(cfg)
			runtime.retryEvery = 5 * time.Millisecond
			if err = runtime.Start(http.NotFoundHandler(), ingest.New(nil, nil)); err != nil {
				t.Fatal(err)
			}
			ctx, cancel := context.WithTimeout(t.Context(), time.Second)
			defer cancel()
			if err = runtime.Close(ctx); err != nil {
				t.Fatal(err)
			}
			select {
			case <-runtime.done:
			default:
				t.Fatal("listener supervisor outlived shutdown")
			}
			occupied.Close()
			for _, address := range cfg.Listen {
				l, err := net.Listen("tcp", address)
				if err != nil {
					t.Fatalf("shutdown left address occupied: %v", err)
				}
				l.Close()
			}
			if err = runtime.Start(http.NotFoundHandler(), ingest.New(nil, nil)); err == nil {
				t.Fatal("closed runtime restarted")
			}
		})
	}
}

func TestNoAvailableListenerDoesNotStartIngestion(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer l.Close()
	path := filepath.Join(t.TempDir(), "ingest.sock")
	runtime := New(config.Config{Fixture: true, Listen: []string{l.Addr().String()}, IngestSocket: path})
	if err = runtime.Start(http.NotFoundHandler(), ingest.New(nil, nil)); err == nil {
		t.Fatal("runtime started without a management listener")
	}
	if _, err = os.Stat(path); !errors.Is(err, os.ErrNotExist) {
		t.Fatalf("ingestion started after failed management startup: %v", err)
	}
}
