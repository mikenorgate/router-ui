import type { MetricRecord } from '../types';
import { rate, timestamp } from '../lib/format';
import { Status } from './Badge';
export function Metric({ metric }: { metric: MetricRecord }) {
  const scaled = rate(metric.value, metric.unit);
  return <div className="metric" data-od-id={`metric-${metric.id}`}><dl><dt>{metric.label || metric.id}</dt><dd><span className="value">{metric.value == null ? '—' : scaled.value}</span><span className="unit mono">{scaled.unit}</span></dd></dl><div className="meta"><Status value={metric.status || (metric.value == null ? 'Missing' : 'Status unknown')} /><span>{metric.scope || 'Measurement scope unavailable'}</span><time dateTime={metric.observed_at || undefined}>{timestamp(metric.observed_at)}</time></div></div>;
}
