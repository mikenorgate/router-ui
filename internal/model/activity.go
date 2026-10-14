package model

import (
	"encoding/json"
	"errors"
	"net/netip"
	"time"
)

// TrafficInterval contains deltas at one canonical accounting point. It never
// contains a connection's lifetime total or extrapolates sampled traffic.
// A producer emits nonoverlapping intervals in time order for each key.
type TrafficInterval struct {
	ID                string    `json:"id"`
	DeviceID          string    `json:"device_id"`
	Segment           string    `json:"segment"`
	Namespace         string    `json:"namespace"`
	Zone              uint16    `json:"zone"`
	ObservationPoint  string    `json:"observation_point"`
	Family            string    `json:"family"`
	From              time.Time `json:"from"`
	To                time.Time `json:"to"`
	BytesSent         uint64    `json:"bytes_sent"`
	BytesReceived     uint64    `json:"bytes_received"`
	ActiveConnections uint32    `json:"active_connections"`
	Partial           bool      `json:"partial,omitempty"`
	CounterStatus     string    `json:"counter_status"`
	SamplingRate      float64   `json:"sampling_rate"`
}

// Binding is copied at collection time. Historical records must not be
// reassigned using the latest neighbour table or lease.
type Binding struct {
	DeviceID string `json:"device_id"`
	Address
}

type DNSAnswer struct {
	Name  string `json:"name"`
	Type  string `json:"type"`
	Value string `json:"value"`
	TTL   uint32 `json:"ttl"`
}

type ExposureListener struct {
	ID                string `json:"id"`
	Address           string `json:"address"`
	Port              uint16 `json:"port"`
	Protocol          string `json:"protocol"`
	ConfiguredLabel   string `json:"configured_label"`
	SourceRestriction string `json:"source_restriction"`
	State             string `json:"state"`
	SourceRef         string `json:"source_ref"`
	Evidence          string `json:"evidence"`
}
type ExposureForward struct {
	ID                string `json:"id"`
	Listen            string `json:"listen"`
	Target            string `json:"target"`
	Protocol          string `json:"protocol"`
	SourceRestriction string `json:"source_restriction"`
	State             string `json:"state"`
	SourceRef         string `json:"source_ref"`
	Evidence          string `json:"evidence"`
}

func (r Record) validateInterval() error {
	var v TrafficInterval
	if err := json.Unmarshal(r.Data, &v); err != nil {
		return err
	}
	if v.ID != r.ID || v.DeviceID != "" && !Identifier(v.DeviceID) || !Identifier(v.Namespace) || !Identifier(v.ObservationPoint) || len(v.Segment) > 128 || (v.Family != "4" && v.Family != "6") || v.From.IsZero() || !v.To.After(v.From) || v.To.Sub(v.From) > time.Minute || !v.To.Equal(r.ObservedAt) || v.BytesSent > 1<<62 || v.BytesReceived > 1<<62 || v.SamplingRate <= 0 || v.SamplingRate > 1 {
		return errors.New("invalid traffic interval")
	}
	switch v.CounterStatus {
	case "measured":
	case "baseline", "gap", "reset":
		if v.BytesSent != 0 || v.BytesReceived != 0 {
			return errors.New("unknown interval cannot contain measured bytes")
		}
	default:
		return errors.New("invalid interval counter status")
	}
	return nil
}

func validBinding(b *Binding) bool {
	if b == nil {
		return true
	}
	_, err := netip.ParseAddr(b.Address.Address)
	return err == nil && Identifier(b.DeviceID) && !b.ValidFrom.IsZero() && (b.ValidUntil == nil || !b.ValidUntil.Before(b.ValidFrom))
}
