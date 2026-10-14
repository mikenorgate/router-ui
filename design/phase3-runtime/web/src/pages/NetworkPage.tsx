import type { Network } from '../types';
import { useFilters, useResource } from '../lib/hooks';
import { Badge } from '../components/Badge';
import { PageHeader, Panel, RecordList, RequestState } from '../components/UI';
import { Link } from 'react-router-dom';
export function NetworkPage() {
  const resource = useResource<Network>('/network', { autoRefresh: true });
  const filters = useFilters();
  return <><PageHeader title="Network" description="Router-local logical interfaces, segments, and routes."><button className="btn" onClick={resource.reload}>Refresh observations</button><Link className="btn" to={filters.href('/network/exposure')}>Configured exposure ↗</Link></PageHeader><RequestState resource={resource}>{data => <div className="stack"><Panel title="Observation coverage"><div className="notice"><Badge tone="unknown">Physical topology unobserved</Badge><p>The router cannot infer physical switch ports, wireless signal, or traffic that stays within an unrelated switched segment.</p></div><ul className="coverage-notes">{(data.coverage_notes || []).map((note, i) => <li key={i}>{note}</li>)}</ul>{!data.coverage_notes?.length && <p className="callout">Source-specific coverage notes unavailable.</p>}</Panel><Panel title="Router interfaces" description="Interface counters are shared totals, not per-device measurements."><RecordList records={data.interfaces} empty="No interfaces observed" /></Panel><div className="two"><Panel title="Segments"><RecordList records={data.segments} empty="No segments observed" /></Panel><Panel title="Routes" description="A configured route does not prove endpoint reachability."><RecordList records={data.routes} empty="No routes observed" /></Panel></div></div>}</RequestState></>;
}
