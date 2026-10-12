//go:build integration

package store

import (
	"context"
	"errors"
	"testing"
)

func TestRetentionStaysWithinInstallationLimits(t *testing.T) {
	s := testStore(t)
	ctx := context.Background()
	for _, tc := range []struct {
		name         string
		raw, history int
		valid        bool
	}{{"exceeds raw ceiling", 8, 90, false}, {"exceeds history ceiling", 7, 91, false}, {"history shorter than detail", 7, 3, false}, {"smaller local policy", 3, 30, true}} {
		t.Run(tc.name, func(t *testing.T) {
			err := s.SetRetention(ctx, tc.raw, tc.history, "admin")
			if tc.valid && err != nil {
				t.Fatal(err)
			}
			if !tc.valid && !errors.Is(err, ErrRetention) {
				t.Fatalf("limits not enforced: %v", err)
			}
		})
	}
	if err := s.loadRetention(ctx); err != nil {
		t.Fatal(err)
	}
	stats, err := s.Stats(ctx)
	if err != nil || stats.RawDays != 3 || stats.HistoryDays != 30 || stats.MaxHistoryDays != 90 {
		t.Fatalf("retention did not persist %+v %v", stats, err)
	}
}
