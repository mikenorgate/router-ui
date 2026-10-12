import { Link, useNavigate } from 'react-router-dom';
import type { Overview } from '../types';
import { query } from '../lib/api';
import { number } from '../lib/format';
import { useFilters, useResource } from '../lib/hooks';
import { Chart } from '../components/Chart';
import { EventTimeline } from '../components/EventTimeline';
import { Metric } from '../components/Metric';
import { SourceTable } from '../components/SourceTable';
import { Empty, PageHeader, Panel, RequestState } from '../components/UI';
export function OverviewPage() {
  const filters = useFilters();
  const navigate = useNavigate();
  const from = filters.params.get('from');
  const to = filters.params.get('to');
  const hasFixed = from !== null || to !== null;
  const qParams = hasFixed ? { from: from || '', to: to || '' } : { range: filters.params.get('range') || '1h' };
  const resource = useResource<Overview>(query('/overview', qParams), { autoRefresh: !hasFixed });
  return <><PageHeader title="Overview" description="Current measurements, recent changes, and the evidence behind them."><button className="btn" onClick={resource.reload}>Refresh observations</button></PageHeader><RequestState resource={resource}>{data => <div className="stack">
    {(data.metrics || []).length ? <div className="metric-strip">{data.metrics!.slice(0, 12).map(metric => <Metric key={metric.id} metric={metric} />)}</div> : <Empty title="No current metrics" detail="The API did not supply current measurements." />}
    <Panel title="Bandwidth timeline" description="Aligned observation lanes · units and coverage come from local sources." action={<Link to={filters.href('/traffic')}>Investigate traffic ↗</Link>}><Chart series={data.series || []} events={data.events} from={filters.params.get('from')} to={filters.params.get('to')} onSelect={(from, to) => navigate(filters.href('/traffic', { from, to }))} /><p className="callout">Interface rates are shared measurements. Per-device totals cannot be inferred from them. Event markers show correlation, not cause.</p></Panel>
    <div className="overview-summary"><Link to={filters.href('/devices')}><span className="mono">{number(data.devices_total)}</span> devices in inventory</Link><Link to={filters.href('/devices')}><span className="mono">{number(data.active_devices)}</span> devices with activity evidence</Link><Link to={filters.href('/traffic')}>{data.capabilities?.find(c => c.id === 'flow')?.supported === false ? <span className="mono">Unsupported</span> : <><span className="mono">{number(data.flows_total)}</span> recorded conversations</>}</Link></div>
    <Panel title="Sources and freshness" description="Observation timestamps qualify current measurements. Uncollected metrics remain unsupported rather than zero." action={<Link to={filters.href('/system')}>All capabilities ↗</Link>}><SourceTable sources={data.sources || []} /></Panel>
    <Panel title="Recent events" description="Changes recorded by local sources; ordering alone does not establish cause." action={<Link to={filters.href('/events')}>All events ↗</Link>}><EventTimeline events={data.events || []} /></Panel>
  </div>}</RequestState></>;
}
