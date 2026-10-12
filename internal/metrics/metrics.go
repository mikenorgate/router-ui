// Package metrics queries an installation-supplied catalog in the local Prometheus store.
package metrics

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
	"net/url"
	"sort"
	"strconv"
	"time"

	"github.com/mikenorgate/router-ui/internal/config"
)

type Point struct {
	Time  time.Time `json:"time"`
	Value *float64  `json:"value"`
}
type Series struct {
	ID     string  `json:"id"`
	Label  string  `json:"label"`
	Unit   string  `json:"unit"`
	Points []Point `json:"points"`
}
type Metric struct {
	ID         string     `json:"id"`
	Label      string     `json:"label"`
	Unit       string     `json:"unit"`
	Scope      string     `json:"scope"`
	Value      *float64   `json:"value"`
	ObservedAt *time.Time `json:"observed_at"`
	Status     string     `json:"status"`
}
type Client struct {
	URL     string
	Catalog map[string]config.MetricQuery
	HTTP    *http.Client
}

func New(c config.Config) *Client {
	return &Client{URL: c.PrometheusURL, Catalog: c.MetricQueries, HTTP: &http.Client{Timeout: 4 * time.Second, CheckRedirect: func(_ *http.Request, _ []*http.Request) error { return http.ErrUseLastResponse }}}
}
func (c *Client) Overview(ctx context.Context, span time.Duration) ([]Metric, []Series) {
	metrics := []Metric{}
	series := []Series{}
	ids := []string{}
	for id := range c.Catalog {
		ids = append(ids, id)
	}
	sort.Strings(ids)
	now := time.Now().UTC()
	step := span / 120
	if step < 30*time.Second {
		step = 30 * time.Second
	}
	for _, id := range ids {
		q := c.Catalog[id]
		m := Metric{ID: id, Label: q.Label, Unit: q.Unit, Scope: q.Scope, Status: "missing"}
		s := Series{ID: id, Label: q.Label, Unit: q.Unit, Points: []Point{}}
		if c.URL != "" {
			values, err := c.query(ctx, q.Query, now.Add(-span), now, step)
			observations := map[int64]*float64{}
			if q.TimestampQuery != "" {
				var e error
				observations, e = c.query(ctx, q.TimestampQuery, now.Add(-span), now, step)
				if e != nil {
					observations = map[int64]*float64{}
				}
			}
			if err == nil {
				for t := now.Add(-span); !t.After(now); t = t.Add(step) {
					s.Points = append(s.Points, Point{Time: t, Value: values[t.Unix()]})
				}
				for i := len(s.Points) - 1; i >= 0; i-- {
					p := s.Points[i]
					if p.Value != nil {
						m.Value = p.Value
						m.Status = "freshness_unknown"
						if observed := observations[p.Time.Unix()]; observed != nil {
							t := time.Unix(int64(*observed), 0).UTC()
							m.ObservedAt = &t
							m.Status = "current"
							if now.Sub(t) > 90*time.Second || t.After(now.Add(5*time.Minute)) {
								m.Status = "stale"
							}
						}
						break
					}
				}
			} else {
				m.Status = "unavailable"
			}
		}
		metrics = append(metrics, m)
		series = append(series, s)
	}
	return metrics, series
}
func (c *Client) query(ctx context.Context, query string, from, to time.Time, step time.Duration) (map[int64]*float64, error) {
	u, err := url.Parse(c.URL + "/api/v1/query_range")
	if err != nil {
		return nil, err
	}
	from = from.Truncate(time.Second)
	params := url.Values{"query": {query}, "start": {strconv.FormatInt(from.Unix(), 10)}, "end": {strconv.FormatInt(to.Unix(), 10)}, "step": {strconv.FormatInt(int64(step.Seconds()), 10)}}
	u.RawQuery = params.Encode()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return nil, err
	}
	response, err := c.HTTP.Do(req)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return nil, errors.New("metrics store unavailable")
	}
	var body struct {
		Status string `json:"status"`
		Data   struct {
			Result []struct {
				Values [][2]json.RawMessage `json:"values"`
			} `json:"result"`
		} `json:"data"`
	}
	d := json.NewDecoder(io.LimitReader(response.Body, 2<<20))
	if err = d.Decode(&body); err != nil {
		return nil, err
	}
	if body.Status != "success" || len(body.Data.Result) > 1 {
		return nil, errors.New("catalog query must produce at most one series")
	}
	out := map[int64]*float64{}
	for _, result := range body.Data.Result {
		if len(result.Values) > 500 {
			return nil, errors.New("too many metric samples")
		}
		for _, pair := range result.Values {
			var ts float64
			var raw string
			if err = json.Unmarshal(pair[0], &ts); err != nil {
				return nil, err
			}
			if err = json.Unmarshal(pair[1], &raw); err != nil {
				return nil, err
			}
			n, err := strconv.ParseFloat(raw, 64)
			if err == nil && !math.IsNaN(n) && !math.IsInf(n, 0) {
				out[int64(ts)] = &n
			}
		}
	}
	return out, nil
}
