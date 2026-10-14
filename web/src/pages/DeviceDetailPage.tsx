// Device detail: the policy-phase page (observed identity, console
// annotations, device firewall policy pages, binding history) extended with
// the Phase 3 investigation surfaces. The traffic tab carries the shared
// time-window lanes — traffic on one axis with binding/event markers — above
// the conversations table; DNS observations get their own tab; history links
// each event to its underlying observation. Phase 3 resources fetch only
// while their tab is active, so an idle device request stays a single
// snapshot. Flow/DNS detail stays Operator-only; Viewer keeps the window
// summary and the permission-limited states.
import { useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Address, Collection, DeviceDetail, Policy } from '../types';
import type { DnsObservation, EventWithRef, FlowWithRef, TrafficSummary } from '../lib/contracts';
import { timestamp, text } from '../lib/format';
import { dnsPath, eventsPath, flowsPath, trafficSummaryPath } from '../lib/phase3Api';
import { useFilters, useResource, type Resource } from '../lib/hooks';
import { policiesPath, usePolicyPages } from '../lib/policies';
import { Badge, Status } from '../components/Badge';
import { AnnotationEditor } from '../components/AnnotationEditor';
import { DataTable } from '../components/DataTable';
import { AccessDeniedNotice, OverflowNotice } from '../components/EvidenceNotices';
import { DnsTable } from '../components/DnsTable';
import { EventTimeline } from '../components/EventTimeline';
import { FlowDetail, FlowTable } from '../components/FlowTable';
import { Inspector } from '../components/Inspector';
import { LinkedEventsTimeline } from '../components/LinkedEventsTimeline';
import { ObservationInspector } from '../components/ObservationInspector';
import { RuleDetail } from '../components/PolicyTable';
import { SourceTable } from '../components/SourceTable';
import { PoliciesPanel } from '../components/PoliciesPanel';
import { TimeWindowLanes, type WindowMarker } from '../components/TimeWindowLanes';
import { Empty, Fields, PageHeader, Panel, Permission, RequestState, Tabs, SearchFilter, FilterSelect } from '../components/UI';
const tabs = ['summary', 'traffic', 'dns', 'firewall', 'addresses', 'history'];

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
  const viewer = session?.user.role === 'viewer';
  const selectedTab = filters.params.get('tab') || 'summary';
  const tab = tabs.includes(selectedTab) ? selectedTab : 'summary';
  const autoRefresh = !filters.params.has('from');
  const window_ = { range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') };
  const resource = useResource<DeviceDetail>(`/devices/${encodeURIComponent(id)}`, { autoRefresh });
  // Phase 3 investigation resources fetch only while their tab is active.
  const summary = useResource<TrafficSummary>(tab === 'traffic' ? trafficSummaryPath({ ...window_, device_id: id }) : null, { autoRefresh });
  const windowFlows = useResource<Collection<FlowWithRef>>(viewer || tab !== 'traffic' ? null : flowsPath({ ...window_, device_id: id, limit: '50', cursor: filters.params.get('cursor') }), { autoRefresh });
  const dns = useResource<Collection<DnsObservation>>(viewer || tab !== 'dns' ? null : dnsPath({ ...window_, device_id: id, limit: '50' }), { autoRefresh });
  const windowEvents = useResource<Collection<EventWithRef>>(tab === 'history' ? eventsPath({ ...window_, device_id: id }) : null, { autoRefresh });
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
  const observationRef = filters.params.get('observation');

  return <RequestState resource={resource}>{data => {
    const d = data.device;
    // current_inventory:false — the device left the inventory; this payload
    // is retained history and must not read as current presence. Annotations
    // stay available: they are console-owned metadata, not router records.
    const historical = data.current_inventory === false;
    const restricted = data.detail_restricted || viewer;
    const flow = restricted ? undefined : [...(windowFlows.data?.items || []), ...(data.flows || [])].find(f => f.id === filters.params.get('flow'));
    const markers: WindowMarker[] = [
      ...(data.bindings || []).filter((b: Address) => b.valid_from).map((b: Address) => ({ time: b.valid_from!, label: `Address binding recorded: ${b.address}`, kind: 'address' })),
      ...(data.events || []).map(e => ({ time: e.time || '', label: e.title || 'Recorded event', kind: e.kind })).filter(m => m.time),
    ].slice(0, 16);
    return <><PageHeader title={data.annotation?.alias || d.name || 'Unnamed device'} description={`${d.segment || 'Segment unavailable'} · ${d.mac || 'MAC unavailable'}`} parent="Devices"><Link className="btn" to={filters.href('/devices')}>Back to devices</Link><Status value={d.status} />{historical && <Badge tone="warn">Not in current inventory</Badge>}</PageHeader><div className="device-context"><span>Last activity <time className="mono">{timestamp(d.last_seen)}</time></span><span>Observed snapshot <time className="mono">{timestamp(d.observed_at)}</time></span></div><Tabs items={tabs} selected={tab} onSelect={value => filters.set('tab', value)} /><section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack" data-od-id={`device-${tab}`}>
      {tab === 'summary' && <><div className="two"><Panel title="Observed identity"><Fields items={[
        ['Device ID', <span className="mono">{d.id}</span>], ['Segment', d.segment], ['MAC', <span className="mono">{d.mac || 'Unavailable'}</span>], ['Presence', <Status value={d.status} />], [historical ? 'Last recorded associations' : 'Current associations', d.addresses?.map(a => <span key={a.address} className="address-line mono">{a.address}</span>) || 'No associations recorded'],
      ]} />{historical
        ? <p className="callout" data-od-id="historical-identity-notice">Not in current inventory. Identity and associations are retained history from the last observation — another device may hold these addresses now. Console annotations remain available for the retained record.</p>
        : <p className="callout">A stale lease or sleeping device does not prove disconnection.</p>}<Link to={filters.href(`/devices/${encodeURIComponent(id)}`, { tab: 'addresses' })}>Address-binding history ↗</Link></Panel><Panel title="Console annotations"><AnnotationEditor key={id} deviceId={id} alias={data.annotation?.alias} note={data.annotation?.note} onSaved={resource.reload} /></Panel></div><Panel title="Recent conversations" description="Recorded values only; shared interface counters are not device totals." action={<Link to={filters.href(`/devices/${encodeURIComponent(id)}`, { tab: 'traffic' })}>Investigate in the time window ↗</Link>}>{restricted ? <Permission /> : <FlowTable flows={data.flows || []} onInspect={f => { const ref = (f as FlowWithRef).observation_ref; if (ref) filters.set('observation', ref); else filters.set('flow', f.id); }} />}</Panel><Panel title="Device sources"><SourceTable sources={d.sources || []} /></Panel><Panel title="Related events"><EventTimeline events={data.events || []} /></Panel></>}
      {tab === 'traffic' && <>
        <Panel title="Shared time window" description="Traffic lanes on one axis. Markers show recorded bindings and events; markers are correlation, not cause. Selecting an interval narrows the window.">
          <RequestState resource={summary}>{s => <TimeWindowLanes lanes={s.series || []} markers={markers} from={window_.from} to={window_.to} onSelect={filters.setWindow} />}</RequestState>
        </Panel>
        <Panel title="Conversations in window" description="Recorded flows attributed with bindings valid at the time. Counts are retained observations after raw-detail sampling, not totals. Rows open their observation by reference." action={<Link to={filters.href('/traffic', { device_id: id })}>Full flow browser ↗</Link>}>
          {restricted ? <Permission /> : <RequestState resource={windowFlows}>{fdata => <>
            {fdata.next_cursor && <OverflowNotice shown={(fdata.items || []).length} limit={50} action={<button className="btn" onClick={() => filters.set('cursor', fdata.next_cursor!)}>Next 50 records</button>} />}
            <FlowTable flows={fdata.items || []} selected={flow?.id} onInspect={f => { const ref = (f as FlowWithRef).observation_ref; if (ref) filters.set('observation', ref); else filters.set('flow', f.id); }} />
            <div className="pagination"><button className="btn" onClick={windowFlows.reload}>Refresh page</button>{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}</div>
          </>}</RequestState>}
        </Panel>
      </>}
      {tab === 'dns' && <Panel title="DNS in window" description="Resolver observations for this device's recorded bindings. Counts are retained observations after raw-detail sampling, not totals. Names do not identify applications.">
        {viewer ? <AccessDeniedNotice detail="DNS observations require the Operator or Administrator role." /> : <RequestState resource={dns}>{ddata => <DnsTable records={ddata.items || []} onInspect={ref => filters.set('observation', ref)} />}</RequestState>}
      </Panel>}
      {tab === 'firewall' && (
        <PoliciesPanel
          title="Policy affecting this device"
          description="Scope and conditions determine applicability. Shared counters do not prove a device match."
          pages={pages}
          selectedRule={rule?.id}
          onInspect={p => filters.set('rule', p.id)}
          onRefresh={pages.reload}
          pageResetKey={`${id}|${q}|${evidence}`}
          filters={<div className="filterbar">
            <SearchFilter value={q} onChange={value => filters.set('q', value)} label="Find a rule" hint="Rule ID, producer, revision or scope" />
            <FilterSelect label="Evidence" value={evidence} onChange={value => filters.set('evidence', value)} options={[["", 'All evidence'], ['installed', 'Installed'], ['applicable', 'Applicable'], ['observed', 'Observed match'], ['unknown', 'Origin unavailable']]} />
            <button className="btn text" onClick={filters.clear}>Clear filters</button>
          </div>}
        />
      )}
      {tab === 'addresses' && <Panel title="Address-binding history"><AddressTable addresses={data.bindings || d.addresses || []} /></Panel>}
      {tab === 'history' && <>
        <Panel title="Events in window" description="Correlated changes are evidence for investigation, not demonstrated causes. Each item can open its underlying observation.">
          <RequestState resource={windowEvents}>{edata => <LinkedEventsTimeline events={edata.items || data.events || []} onInspectObservation={ref => filters.set('observation', ref)} />}</RequestState>
        </Panel>
        <Panel title="Address-binding history"><AddressTable addresses={data.bindings || d.addresses || []} /></Panel>
      </>}
    </section>{flow && <Inspector title={`Flow ${flow.id}`} onClose={() => filters.set('flow', '')}><FlowDetail flow={flow} /></Inspector>}{rule && <Inspector title={`Rule ${rule.id}`} onClose={() => filters.set('rule', '')}><RuleDetail policy={rule} /></Inspector>}{filters.params.has('flow') && !flow && !observationRef && <Empty title={data.detail_restricted ? 'Flow detail restricted' : 'Flow not in this response'} detail="The selected flow may be outside this bounded device response." />}{observationRef && !viewer && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}{observationRef && viewer && <AccessDeniedNotice />}</>;
  }}</RequestState>;
}
