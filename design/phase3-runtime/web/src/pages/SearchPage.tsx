import { Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Collection, ConsoleEvent, Device, Flow, Policy } from '../types';
import { query } from '../lib/api';
import { useFilters, useResource } from '../lib/hooks';
import { EventTimeline } from '../components/EventTimeline';
import { Empty, PageHeader, Panel, Permission, RequestState, SearchFilter } from '../components/UI';
export function SearchPage() {
  const filters = useFilters();
  const q = (filters.params.get('q') || '').slice(0, 200);
  const { session } = useAuth();
  const devices = useResource<Collection<Device>>(q ? query('/devices', { q }) : null);
  const flows = useResource<Collection<Flow>>(q && session?.user.role !== 'viewer' ? query('/flows', { q, limit: '50' }) : null);
  const policies = useResource<Collection<Policy>>(q ? '/policies' : null);
  const events = useResource<Collection<ConsoleEvent>>(q ? query('/events', { q }) : null);
  return <><PageHeader title="Search" description="Bounded searches across devices, recorded traffic, installed policy, and events." /><SearchFilter label="Search observations" value={q} onChange={value => filters.set('q', value)} />{!q ? <Empty title="Enter a name, address or rule ID" /> : <div className="stack search-results"><Panel title="Devices"><RequestState resource={devices}>{data => data.items?.length ? <ul>{data.items.map(d => <li key={d.id}><Link to={filters.href(`/devices/${encodeURIComponent(d.id)}`)}>{d.name || d.id}</Link></li>)}</ul> : <Empty title="No device matches" />}</RequestState></Panel><Panel title="Traffic">{session?.user.role === 'viewer' ? <Permission /> : <RequestState resource={flows}>{data => data.items?.length ? <ul>{data.items.map(f => <li key={f.id}><Link to={filters.href('/traffic', { q, flow: f.id })}>{f.id} · {f.source_ip || 'Unknown'} → {f.destination_ip || 'Unknown'}</Link></li>)}</ul> : <Empty title="No flow matches" />}</RequestState>}</Panel><Panel title="Installed policy"><RequestState resource={policies}>{data => { const matches = (data.items || []).filter(p => JSON.stringify(p).toLowerCase().includes(q.toLowerCase())); return matches.length ? <ul>{matches.map(p => <li key={p.id}><Link to={filters.href('/firewall', { rule: p.id })}>{p.id} · {p.name}</Link></li>)}</ul> : <Empty title="No policy matches" />; }}</RequestState></Panel><Panel title="Events"><RequestState resource={events}>{data => <EventTimeline events={data.items || []} />}</RequestState></Panel></div>}</>;
}
