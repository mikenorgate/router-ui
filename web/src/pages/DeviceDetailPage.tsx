import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Address, Collection, DeviceDetail, Policy } from '../types';
import { timestamp, text } from '../lib/format';
import { useFilters, useResource, type Resource } from '../lib/hooks';
import { policiesPath, usePolicyPages } from '../lib/policies';
import { Status } from '../components/Badge';
import { AnnotationEditor } from '../components/AnnotationEditor';
import { DataTable } from '../components/DataTable';
import { EventTimeline } from '../components/EventTimeline';
import { FlowDetail, FlowTable } from '../components/FlowTable';
import { Inspector } from '../components/Inspector';
import { RuleDetail } from '../components/PolicyTable';
import { SourceTable } from '../components/SourceTable';
import { PoliciesPanel } from '../components/PoliciesPanel';
import { Empty, Fields, PageHeader, Panel, Permission, RequestState, Tabs, SearchFilter, FilterSelect } from '../components/UI';
const tabs = ['summary', 'traffic', 'firewall', 'addresses', 'history'];

export function AddressTable({ addresses }: { addresses: Address[] }) {
  return <DataTable rows={addresses.map((a, i) => ({ ...a, id: `${a.address}-${i}` }))} caption="Binding validity qualifies historical attribution. An address alone does not prove device identity." columns={[
    { key: 'address', label: 'Address / family', sort: a => a.address, render: a => <span className="mono">{a.address}<span className="sub">{text(a.family)}</span></span> },
    { key: 'from', label: 'Valid from', sort: a => a.valid_from, render: a => <span className="mono">{timestamp(a.valid_from)}</span> },
    { key: 'until', label: 'Valid until', sort: a => a.valid_until, render: a => a.valid_until ? <span className="mono">{timestamp(a.valid_until)}</span> : 'End not recorded' },
    { key: 'source', label: 'Association source', sort: a => a.source, render: a => a.source || 'Source unavailable' },
    { key: 'confidence', label: 'Confidence', render: a => text(a.confidence, 'Confidence unavailable') },
  ]} />;
}
export function DeviceDetailPage() {
  const { id = '' } = useParams();
  const filters = useFilters();
  const { session } = useAuth();
  const selectedTab = filters.params.get('tab') || 'summary';
  const tab = tabs.includes(selectedTab) ? selectedTab : 'summary';
  const autoRefresh = !filters.params.has('from');
  const resource = useResource<DeviceDetail>(`/devices/${encodeURIComponent(id)}`, { autoRefresh });
  const q = filters.params.get('q') || '';
  const evidence = filters.params.get('evidence') || '';
  const filtered = !!(q || evidence);
  // Unfiltered, the device detail payload is the first policy page (same snapshot as the device).
  // With search/evidence filters the tab queries the bounded policies collection server-side instead.
  const filteredResource = useResource<Collection<Policy>>(filtered ? policiesPath({ deviceId: id, q, evidence }) : null, { autoRefresh });
  const embedded = useMemo<Collection<Policy> | undefined>(() => resource.data ? {
    items: resource.data.policies || [],
    next_cursor: resource.data.policies_next_cursor || null,
    sources: resource.data.policy_sources,
  } : undefined, [resource.data]);
  const embeddedResource = useMemo<Resource<Collection<Policy>>>(() => ({
    data: embedded, error: resource.error, loading: resource.loading, reload: resource.reload,
  }), [embedded, resource.error, resource.loading, resource.reload]);
  const pages = usePolicyPages(filtered ? filteredResource : embeddedResource, { deviceId: id, q, evidence });
  const rule = pages.policies.find(p => p.id === filters.params.get('rule'));

  return <RequestState resource={resource}>{data => {
    const d = data.device;
    const restricted = data.detail_restricted || session?.user.role === 'viewer';
    const flow = restricted ? undefined : data.flows?.find(f => f.id === filters.params.get('flow'));
    return <><PageHeader title={data.annotation?.alias || d.name || 'Unnamed device'} description={`${d.segment || 'Segment unavailable'} · ${d.mac || 'MAC unavailable'}`} parent="Devices"><Link className="btn" to={filters.href('/devices')}>Back to devices</Link><Status value={d.status} /></PageHeader><div className="device-context"><span>Last activity <time className="mono">{timestamp(d.last_seen)}</time></span><span>Observed snapshot <time className="mono">{timestamp(d.observed_at)}</time></span></div><Tabs items={tabs} selected={tab} onSelect={value => filters.set('tab', value)} /><section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack" data-od-id={`device-${tab}`}>
      {tab === 'summary' && <><div className="two"><Panel title="Observed identity"><Fields items={[
        ['Device ID', <span className="mono">{d.id}</span>], ['Segment', d.segment], ['MAC', <span className="mono">{d.mac || 'Unavailable'}</span>], ['Presence', <Status value={d.status} />], ['Current associations', d.addresses?.map(a => <span key={a.address} className="address-line mono">{a.address}</span>) || 'No associations recorded'],
      ]} /><p className="callout">A stale lease or sleeping device does not prove disconnection.</p><Link to={filters.href(`/devices/${encodeURIComponent(id)}`, { tab: 'addresses' })}>Address-binding history ↗</Link></Panel><Panel title="Console annotations"><AnnotationEditor key={id} deviceId={id} alias={data.annotation?.alias} note={data.annotation?.note} onSaved={resource.reload} /></Panel></div><Panel title="Recent conversations" description="Recorded values only; shared interface counters are not device totals." action={<Link to={filters.href('/traffic', { device_id: id })}>Investigate traffic ↗</Link>}>{restricted ? <Permission /> : <FlowTable flows={data.flows || []} onInspect={f => filters.set('flow', f.id)} />}</Panel><Panel title="Device sources"><SourceTable sources={d.sources || []} /></Panel><Panel title="Related events"><EventTimeline events={data.events || []} /></Panel></>}
      {tab === 'traffic' && <Panel title="Device traffic" action={<Link to={filters.href('/traffic', { device_id: id })}>Full flow browser ↗</Link>}>{restricted ? <Permission /> : <FlowTable flows={data.flows || []} selected={flow?.id} onInspect={f => filters.set('flow', f.id)} />}</Panel>}
      {tab === 'firewall' && (
        <PoliciesPanel
          title="Policy affecting this device"
          description="Scope and conditions determine applicability. Shared counters do not prove a device match."
          pages={pages}
          selectedRule={rule?.id}
          onInspect={p => filters.set('rule', p.id)}
          onRefresh={pages.reload}
          filters={<div className="filterbar">
            <SearchFilter value={q} onChange={value => filters.set('q', value)} label="Find a rule" hint="Rule ID, producer, revision or scope" />
            <FilterSelect label="Evidence" value={evidence} onChange={value => filters.set('evidence', value)} options={[["", 'All evidence'], ['installed', 'Installed'], ['applicable', 'Applicable'], ['observed', 'Observed match'], ['unknown', 'Origin unavailable']]} />
            <button className="btn text" onClick={filters.clear}>Clear filters</button>
          </div>}
        />
      )}
      {tab === 'addresses' && <Panel title="Address-binding history"><AddressTable addresses={data.bindings || d.addresses || []} /></Panel>}
      {tab === 'history' && <Panel title="Device history" description="Correlated changes are evidence for investigation, not demonstrated causes."><EventTimeline events={data.events || []} /></Panel>}
    </section>{flow && <Inspector title={`Flow ${flow.id}`} onClose={() => filters.set('flow', '')}><FlowDetail flow={flow} /></Inspector>}{rule && <Inspector title={`Rule ${rule.id}`} onClose={() => filters.set('rule', '')}><RuleDetail policy={rule} /></Inspector>}{filters.params.has('flow') && !flow && <Empty title={data.detail_restricted ? 'Flow detail restricted' : 'Flow not in this response'} detail="The selected flow may be outside this bounded device response." />}</>;
  }}</RequestState>;
}
