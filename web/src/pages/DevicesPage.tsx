import { Link } from 'react-router-dom';
import type { Collection, Device } from '../types';
import { query } from '../lib/api';
import { timestamp } from '../lib/format';
import { useFilters, useResource } from '../lib/hooks';
import { Status } from '../components/Badge';
import { DataTable } from '../components/DataTable';
import { PageHeader, Panel, RequestState, SearchFilter } from '../components/UI';
export function DevicesPage() {
  const filters = useFilters();
  const q = filters.params.get('q') || '';
  const resource = useResource<Collection<Device>>(query('/devices', { q }));
  return <><PageHeader title="Devices" description="Observed identities and address associations. Silence does not prove disconnection." /><Panel title="Device inventory" action={<button className="btn" onClick={resource.reload}>Refresh</button>}><div className="filterbar"><SearchFilter value={q} onChange={value => filters.set('q', value)} label="Find a device" hint="Name, address, MAC or segment" />{q && <button className="btn text" onClick={filters.clear}>Clear filters</button>}</div><RequestState resource={resource}>{data => <DataTable rows={data.items || []} caption="Identity evidence comes from the listed sources. Aliases affect console annotations only." onClear={filters.clear} columns={[
    { key: 'name', label: 'Device', sort: d => d.name || d.id, render: d => <><Link className="device-link" to={filters.href(`/devices/${encodeURIComponent(d.id)}`)}>{d.name || 'Unnamed device'}</Link><span className="sub mono">{d.mac || 'MAC unavailable'}</span></> },
    { key: 'segment', label: 'Segment', sort: d => d.segment, render: d => d.segment || 'Segment unavailable' },
    { key: 'address', label: 'Addresses', render: d => d.addresses?.length ? <div className="address-list">{d.addresses.map(a => <span className="mono" key={a.address}>{a.address}</span>)}</div> : 'No address associations' },
    { key: 'status', label: 'Presence evidence', sort: d => d.status, render: d => <Status value={d.status} /> },
    { key: 'seen', label: 'Last activity', sort: d => d.last_seen, render: d => <><time className="mono">{timestamp(d.last_seen)}</time><span className="sub">Snapshot: {timestamp(d.observed_at)}</span></> },
    { key: 'inspect', label: 'Details', render: d => <Link className="btn text" to={filters.href(`/devices/${encodeURIComponent(d.id)}`)}>Open device ↗</Link> },
  ]} />}</RequestState></Panel></>;
}
