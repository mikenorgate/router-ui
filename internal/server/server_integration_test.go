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
	occupied, err := net.Listen("tcp", "127.0.0.1:0")
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
		template := x509.Certificate{SerialNumber: big.NewInt(serial), Subject: pkix.Name{CommonName: "localhost"}, NotBefore: time.Now().Add(-time.Minute), NotAfter: time.Now().Add(time.Hour), IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, DNSNames: []string{"localhost"}, KeyUsage: x509.KeyUsageDigitalSignature, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth}}
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
