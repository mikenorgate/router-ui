// Command router-console-publish submits a versioned batch as the invoking producer UID.
package main

import (
	"context"
	"flag"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"time"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
func run() error {
	socket := flag.String("socket", "", "console ingestion socket")
	flag.Parse()
	if *socket == "" {
		return fmt.Errorf("-socket required; batch JSON is read from stdin")
	}
	ctx, cancel := context.WithTimeout(context.Background(), 8*time.Second)
	defer cancel()
	transport := &http.Transport{DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
		return (&net.Dialer{}).DialContext(ctx, "unix", *socket)
	}}
	defer transport.CloseIdleConnections()
	client := http.Client{Transport: transport, Timeout: 8 * time.Second}
	req, err := http.NewRequestWithContext(ctx, "POST", "http://unix/ingest/v1/batches", io.LimitReader(os.Stdin, (1<<20)+1))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	response, err := client.Do(req)
	if err != nil {
		return err
	}
	defer response.Body.Close()
	if response.StatusCode != 200 {
		return fmt.Errorf("batch not acknowledged (HTTP %d); retain and retry the same sequence/cursor", response.StatusCode)
	}
	_, err = io.Copy(os.Stdout, io.LimitReader(response.Body, 8192))
	return err
}
