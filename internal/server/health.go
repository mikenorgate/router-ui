package server

import "time"

func (s *Runtime) Health() map[string]float64 {
	s.mu.RLock()
	defer s.mu.RUnlock()
	out := map[string]float64{"listeners_available": 0, "listeners_unavailable": 0, "certificate_reload_failures": 0}
	for _, l := range s.listeners {
		if l.Status == "listening" {
			out["listeners_available"]++
		} else {
			out["listeners_unavailable"]++
		}
	}
	for _, c := range s.certStatus {
		if c.Status == "reload_failed" {
			out["certificate_reload_failures"]++
		}
		seconds := time.Until(c.ExpiresAt).Seconds()
		if current, ok := out["certificate_expiry_seconds"]; !ok || seconds < current {
			out["certificate_expiry_seconds"] = seconds
		}
	}
	return out
}
