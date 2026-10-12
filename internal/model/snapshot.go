package model

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

const SnapshotVersion = 2
const MaxSnapshotBytes = 32 << 20
const MaxSnapshotRecords = 65536
const MaxChunkBytes = 1 << 20
const MaxChunkRecords = 256

// SnapshotIdentity is repeated in every chunk and commit. ObservedAt is the
// original collection time, never the transport or retry time.
type SnapshotIdentity struct {
	Version    int       `json:"version"`
	SourceID   string    `json:"source_id"`
	BootID     string    `json:"boot_id"`
	Sequence   uint64    `json:"sequence"`
	Scope      string    `json:"scope"`
	Generation string    `json:"generation"`
	ObservedAt time.Time `json:"observed_at"`
}
type SnapshotChunk struct {
	SnapshotIdentity
	Index   int      `json:"index"`
	Records []Record `json:"records"`
}
type SnapshotCommit struct {
	SnapshotIdentity
	Chunks   int    `json:"chunks"`
	Records  int    `json:"records"`
	Digest   string `json:"digest"`
	Cursor   string `json:"cursor"`
	Complete bool   `json:"complete"`
}
type SourceStatus struct {
	Version     int    `json:"version"`
	SourceID    string `json:"source_id"`
	Scope       string `json:"scope"`
	Status      string `json:"status"`
	ErrorCode   string `json:"error_code"`
	Coverage    string `json:"coverage"`
	LostRecords uint64 `json:"lost_records"`
}

type Rule struct{ Policy }
type Application struct {
	ID                     string     `json:"id"`
	RuleID                 string     `json:"rule_id"`
	DeviceID               string     `json:"device_id"`
	BindingRef             string     `json:"binding_ref"`
	InstallationGeneration string     `json:"installation_generation"`
	Installed              *bool      `json:"installed"`
	Applicable             *bool      `json:"applicable"`
	ObservedMatch          *bool      `json:"observed_match"`
	CountersScope          string     `json:"counters_scope"`
	Packets                *uint64    `json:"packets"`
	Bytes                  *uint64    `json:"bytes"`
	Lifecycle              string     `json:"lifecycle"`
	LifecycleAt            time.Time  `json:"lifecycle_at"`
	ObservedAt             time.Time  `json:"observed_at"`
	ExpiresAt              *time.Time `json:"expires_at,omitempty"`
}
type ServiceObservation struct {
	Name   string `json:"name"`
	Status string `json:"status"`
}
type StorageObservation struct {
	Mount          string `json:"mount"`
	AvailableBytes uint64 `json:"available_bytes"`
	TotalBytes     uint64 `json:"total_bytes"`
}
type Appliance struct {
	ID                string               `json:"id"`
	ImageVersion      string               `json:"image_version"`
	BootID            string               `json:"boot_id"`
	ObservedAt        time.Time            `json:"observed_at"`
	ClockSynchronized *bool                `json:"clock_synchronized"`
	Services          []ServiceObservation `json:"services"`
	Storage           []StorageObservation `json:"storage"`
}

func ScopeKinds(scope string) []string {
	switch scope {
	case "devices":
		return []string{"device"}
	case "policies":
		return []string{"rule", "application"}
	case "appliance":
		return []string{"appliance"}
	case "network":
		return []string{"network"}
	}
	return nil
}
func (i SnapshotIdentity) Validate(now time.Time) error {
	if i.Version != SnapshotVersion || !Identifier(i.SourceID) || !Identifier(i.BootID) || !Identifier(i.Generation) || i.Sequence == 0 || i.Sequence > 1<<62 || len(ScopeKinds(i.Scope)) == 0 || i.ObservedAt.IsZero() || i.ObservedAt.After(now.Add(5*time.Minute)) || i.ObservedAt.Before(now.AddDate(0, 0, -90)) {
		return errors.New("invalid snapshot identity")
	}
	return nil
}
func (c SnapshotChunk) Validate(now time.Time, allowed []string) error {
	if err := c.SnapshotIdentity.Validate(now); err != nil {
		return err
	}
	if c.Index < 0 || c.Index >= MaxSnapshotRecords || len(c.Records) > MaxChunkRecords {
		return errors.New("invalid chunk bounds")
	}
	kinds := ScopeKinds(c.Scope)
	for _, r := range c.Records {
		found := false
		for _, k := range kinds {
			for _, a := range allowed {
				if r.Kind == k && k == a {
					found = true
				}
			}
		}
		var data any
		switch r.Kind {
		case "device":
			data = &Device{}
		case "rule":
			data = &Policy{}
		case "application":
			data = &Application{}
		case "appliance":
			data = &Appliance{}
		case "network":
			data = &Network{}
		}
		decoder := json.NewDecoder(bytes.NewReader(r.Data))
		decoder.DisallowUnknownFields()
		if data == nil || decoder.Decode(data) != nil {
			return errors.New("invalid snapshot record fields")
		}
		if !found || !strings.HasPrefix(r.ID, c.SourceID+":") {
			return errors.New("unauthorized kind or record namespace")
		}
	}
	b := Batch{Version: 1, SourceID: c.SourceID, BootID: c.BootID, Sequence: c.Sequence, SamplingRate: 1, Records: c.Records}
	if err := b.Validate(now, allowed); err != nil {
		return err
	}
	encoded, err := json.Marshal(c)
	if err != nil {
		return err
	}
	if len(encoded) > MaxChunkBytes {
		return errors.New("chunk too large")
	}
	return nil
}
func (c SnapshotCommit) Validate(now time.Time) error {
	if err := c.SnapshotIdentity.Validate(now); err != nil {
		return err
	}
	digest, err := hex.DecodeString(c.Digest)
	if err != nil || len(digest) != sha256.Size || c.Chunks < 1 || c.Chunks > MaxSnapshotRecords || c.Records < 0 || c.Records > MaxSnapshotRecords || len(c.Cursor) > 2048 || !c.Complete {
		return errors.New("invalid complete snapshot manifest")
	}
	return nil
}

// SnapshotDigest hashes Go-encoded wire chunks in index order, each followed
// by a newline. Other producers hash their exact transmitted JSON bytes instead.
func SnapshotDigest(chunks []SnapshotChunk) (string, error) {
	h := sha256.New()
	for _, c := range chunks {
		b, e := json.Marshal(c)
		if e != nil {
			return "", e
		}
		_, _ = h.Write(b)
		_, _ = h.Write([]byte{'\n'})
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}
func (s SourceStatus) Validate() error {
	if s.Version != 2 || !Identifier(s.SourceID) || len(ScopeKinds(s.Scope)) == 0 || len(s.Coverage) > 1024 || len(s.ErrorCode) > 64 {
		return errors.New("invalid source status")
	}
	if s.ErrorCode != "" && !Identifier(s.ErrorCode) {
		return errors.New("invalid error code")
	}
	switch s.Status {
	case "missing", "failed", "partial", "unsupported", "current":
		return nil
	}
	return errors.New("invalid health status")
}
