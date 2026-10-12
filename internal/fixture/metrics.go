package fixture

import (
	"github.com/mikenorgate/router-ui/internal/metrics"
	"math"
	"time"
)

// Metrics returns synthetic measurements only when the appliance explicitly selects fixture mode.
func Metrics(span time.Duration) ([]metrics.Metric, []metrics.Series) {
	now := time.Now().UTC().Truncate(30 * time.Second)
	m := []metrics.Metric{}
	series := []metrics.Series{}
	for index, definition := range []struct {
		id, label, unit string
		base            float64
	}{{"download", "WAN download", "B/s", 4200000}, {"upload", "WAN upload", "B/s", 840000}, {"cpu", "Router CPU", "%", 18}, {"latency", "Gateway latency", "ms", 7}} {
		s := metrics.Series{ID: definition.id, Label: definition.label, Unit: definition.unit, Points: []metrics.Point{}}
		for i := 0; i <= 120; i++ {
			v := definition.base * (1 + 0.3*math.Sin(float64(i)/8+float64(index)))
			p := metrics.Point{Time: now.Add(-span + time.Duration(i)*span/120), Value: &v}
			if i > 45 && i < 50 {
				p.Value = nil
			}
			s.Points = append(s.Points, p)
		}
		last := s.Points[len(s.Points)-1]
		m = append(m, metrics.Metric{ID: definition.id, Label: definition.label, Unit: definition.unit, Scope: "Synthetic fixture", Value: last.Value, ObservedAt: &last.Time, Status: "current"})
		series = append(series, s)
	}
	return m, series
}
