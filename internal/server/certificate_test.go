package server

import (
	"crypto/tls"
	"crypto/x509"
	"net"
	"testing"
	"time"
)

type localConn struct {
	net.Conn
	address net.Addr
}

func (c localConn) LocalAddr() net.Addr { return c.address }
func TestIPCertificateSelectionWithoutSNI(t *testing.T) {
	left, right := net.Pipe()
	defer left.Close()
	defer right.Close()
	v4 := &tls.Certificate{Leaf: &x509.Certificate{IPAddresses: []net.IP{net.ParseIP("192.0.2.1")}, NotAfter: time.Now().Add(time.Hour)}}
	v6 := &tls.Certificate{Leaf: &x509.Certificate{IPAddresses: []net.IP{net.ParseIP("2001:db8::1")}, NotAfter: time.Now().Add(time.Hour)}}
	runtime := &Runtime{certs: []*tls.Certificate{v4, v6}}
	hello := &tls.ClientHelloInfo{Conn: localConn{Conn: left, address: &net.TCPAddr{IP: net.ParseIP("2001:db8::1"), Port: 8443}}}
	got, err := runtime.certificate(hello)
	if err != nil || got != v6 {
		t.Fatalf("no-SNI IPv6 request selected wrong management certificate: %v", err)
	}
}
