// Overview: current measurements preserved from /overview (metric strip,
// inventory counts, source freshness) plus the Phase 3 investigation
// surfaces — the interval chart with explicit gaps, the device traffic
// ranking with its unattributed bucket, and the linked recent-events excerpt.
// Summary surfaces stay Viewer-readable; the observation inspector opened
// from a ranking row or event enforces its own role server-side.
import { Link, useNavigate } from 'react-router-dom';
import type { Collection, ConsoleEvent, Overview } from '../types';
import type { TrafficSummary } from '../lib/contracts';
import { query } from '../lib/api';
import { number } from '../lib/format';
import { eventsPath, trafficSummaryPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { IntervalSummaryChart } from '../components/IntervalSummaryChart';
import { LinkedEventsTimeline } from '../components/LinkedEventsTimeline';
import { Metric } from '../components/Metric';
import { ObservationInspector } from '../components/ObservationInspector';
import { SourceTable } from '../components/SourceTable';
import { TrafficRanking } from '../components/TrafficRanking';
import { Empty, PageHeader, Panel, RequestState } from '../components/UI';

export function OverviewPage() {
  const filters = useFilters();
  const navigate = useNavigate();
  const from = filters.params.get('from');
  const to = filters.params.get('to');
  const hasFixed = from !== null || to !== null;
  const qParams = hasFixed ? { from: from || '', to: to || '' } : { range: filters.params.get('range') || '1h' };
  const resource = useResource<Overview>(query('/overview', qParams), { autoRefresh: !hasFixed });
  const window_ = { range: filters.params.get('range'), from, to };
  const summary = useResource<TrafficSummary>(trafficSummaryPath(window_), { autoRefresh: !hasFixed });
  const events = useResource<Collection<ConsoleEvent>>(eventsPath(window_), { autoRefresh: !hasFixed });
  const observationRef = filters.params.get('observation');
  return <><PageHeader title="Overview" description="Current measurements, ranked device traffic, and recent changes — each with the evidence behind it."><button className="btn" onClick={() => { resource.reload(); summary.reload(); events.reload(); }}>Refresh observations</button></PageHeader><RequestState resource={resource}>{data => <div className="stack">
    {(data.metrics || []).length ? <div className="metric-strip">{data.metrics!.slice(0, 12).map(metric => <Metric key={metric.id} metric={metric} />)}</div> : <Empty title="No current metrics" detail="The API did not supply current measurements." />}
    <RequestState resource={summary}>{s => <>
      <Panel title="Bandwidth and attribution timeline" description="Lanes share one time axis; gaps break the measured path. Selecting an interval carries it into Traffic." action={<button className="btn text" onClick={() => navigate(filters.href('/traffic'))}>Investigate traffic ↗</button>}>
        <IntervalSummaryChart summary={s} events={events.data?.items} from={from} to={to} onSelect={(start, end) => navigate(filters.href('/traffic', { from: start, to: end }))} />
      </Panel>
      <Panel title="Device traffic ranking" description="Ranked by recorded bytes in this window. Shared interface counters never appear as device totals.">
        <TrafficRanking rankings={s.rankings || []} unattributed={s.unattributed} accounting={s.accounting} truncated={s.rankings_truncated} onInspect={ref => filters.set('observation', ref)} />
      </Panel>
    </>}</RequestState>
    <div className="overview-summary"><Link to={filters.href('/devices')}><span className="mono">{number(data.devices_total)}</span> devices in inventory</Link><Link to={filters.href('/devices')}><span className="mono">{number(data.active_devices)}</span> devices with activity evidence</Link><Link to={filters.href('/traffic')}>{data.capabilities?.find(c => c.id === 'flow')?.supported === false ? <span className="mono">Unsupported</span> : <><span className="mono">{number(data.flows_total)}</span> recorded conversations</>}</Link></div>
    <Panel title="Sources and freshness" description="Observation timestamps qualify current measurements. Uncollected metrics remain unsupported rather than zero." action={<Link to={filters.href('/system')}>All capabilities ↗</Link>}><SourceTable sources={data.sources || []} /></Panel>
    <RequestState resource={events}>{edata => <Panel title="Recent events" description="Recorded changes beside the same window; ordering is correlation, not cause." action={<Link to={filters.href('/events')}>All events ↗</Link>}>
      <LinkedEventsTimeline events={(edata.items || []).slice(0, 8)} onInspectObservation={ref => filters.set('observation', ref)} />
    </Panel>}</RequestState>
  </div>}</RequestState>
  {observationRef && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
  </>;
}
