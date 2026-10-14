// Overview interval chart: aligned lanes from /api/v1/traffic/summary with its
// evidence qualifiers (accounting kind, source vs storage sampling, explicit
// gaps) rendered beside the chart, never left implied. The measured path and
// gap bands themselves come from the existing Chart component.
import type { ConsoleEvent } from '../types';
import type { TrafficSummary } from '../lib/contracts';
import { number, timestamp } from '../lib/format';
import { Badge } from './Badge';
import { Chart } from './Chart';
import { AccountingNotice, GapNotice, SamplingNotice } from './EvidenceNotices';

export function IntervalSummaryChart({ summary, events = [], from, to, onSelect }: {
  summary: TrafficSummary;
  events?: ConsoleEvent[];
  from?: string | null;
  to?: string | null;
  onSelect?: (from: string, to: string) => void;
}) {
  const gaps = summary.gaps || [];
  const reconciliation = summary.reconciliation;
  return <div className="stack" data-od-id="interval-summary-chart">
    <div className="badge-row" aria-label="Evidence qualifiers for this chart">
      <Badge tone="plain">{summary.accounting === 'live-interval' ? 'Live interval accounting' : 'Completed-flow totals'}</Badge>
      {summary.interval.live && <Badge tone="warn">Window still accumulating</Badge>}
      {gaps.length > 0 && <Badge tone="warn">{gaps.length} measurement gap{gaps.length === 1 ? '' : 's'}</Badge>}
      {summary.generated_at && <span className="muted small mono">Generated {timestamp(summary.generated_at)}</span>}
    </div>
    <AccountingNotice accounting={summary.accounting} live={summary.interval.live} />
    <Chart series={summary.series || []} events={events} from={from} to={to} onSelect={onSelect} />
    <GapNotice gaps={gaps} />
    {summary.sampling && <SamplingNotice sourceRate={summary.sampling.source_rate} storageRate={summary.sampling.storage_rate} note={summary.sampling.note} />}
    {reconciliation && <p className="callout" data-od-id="reconciliation-note">
      Attributed <span className="mono">{number(reconciliation.attributed_bytes)}</span> bytes of <span className="mono">{number(reconciliation.interface_bytes)}</span> interface bytes. {reconciliation.note || 'The remainder is unattributed or unsampled traffic.'}
    </p>}
  </div>;
}
