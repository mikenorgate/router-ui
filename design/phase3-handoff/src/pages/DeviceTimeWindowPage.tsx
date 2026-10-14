// Phase 3 device investigation page: traffic, DNS, connections and history in
// one shared time window. Lanes align on a single axis with binding and event
// markers; the tables below are scoped to the same window, so a spike can be
// carried from chart to records without losing context.
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Address, Collection, DeviceDetail } from '../types';
import type { DnsObservation, EventWithRef, FlowWithRef, TrafficSummary } from '../lib/contracts';
import { timestamp } from '../lib/format';
import { dnsPath, eventsPath, flowsPath, trafficSummaryPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { Status } from '../components/Badge';
import { AddressTable } from './DeviceDetailPage';
import { AccessDeniedNotice, OverflowNotice } from '../components/EvidenceNotices';
import { DnsTable } from '../components/DnsTable';
import { FlowTable } from '../components/FlowTable';
import { LinkedEventsTimeline } from '../components/LinkedEventsTimeline';
import { ObservationInspector } from '../components/ObservationInspector';
import { TimeWindowLanes, type WindowMarker } from '../components/TimeWindowLanes';
import { Empty, PageHeader, Panel, RequestState, Tabs } from '../components/UI';

const tabs = ['conversations', 'dns', 'history'];

export function DeviceTimeWindowPage() {
  const { id = '' } = useParams();
  const filters = useFilters();
  const { session } = useAuth();
  const viewer = session?.user.role === 'viewer';
  const selectedTab = filters.params.get('tab') || 'conversations';
  const tab = tabs.includes(selectedTab) ? selectedTab : 'conversations';
  const window_ = { range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') };
  const autoRefresh = !filters.params.has('from');

  const detail = useResource<DeviceDetail>(`/devices/${encodeURIComponent(id)}`, { autoRefresh });
  const summary = useResource<TrafficSummary>(trafficSummaryPath({ ...window_, device_id: id }), { autoRefresh });
  const flows = useResource<Collection<FlowWithRef>>(viewer ? null : flowsPath({ ...window_, device_id: id, limit: '50', cursor: filters.params.get('cursor') }));
  const dns = useResource<Collection<DnsObservation>>(viewer ? null : dnsPath({ ...window_, device_id: id, limit: '50' }));
  const events = useResource<Collection<EventWithRef>>(eventsPath({ ...window_, device_id: id }), { autoRefresh });
  const observationRef = filters.params.get('observation');

  const markers: WindowMarker[] = [
    ...(detail.data?.bindings || []).filter((b: Address) => b.valid_from).map((b: Address) => ({ time: b.valid_from!, label: `Address binding recorded: ${b.address}`, kind: 'address' })),
    ...(events.data?.items || []).map(e => ({ time: e.time || '', label: e.title || 'Recorded event', kind: e.kind })).filter(m => m.time),
  ].slice(0, 16);

  return <RequestState resource={detail}>{data => {
    const d = data.device;
    return <>
      <PageHeader title={data.annotation?.alias || d.name || 'Unnamed device'} description={`${d.segment || 'Segment unavailable'} · traffic, DNS, connections and history in one shared window`} parent="Devices">
        <Link className="btn" to={filters.href('/devices')}>Back to devices</Link><Status value={d.status} />
      </PageHeader>
      <div className="device-context"><span>Last activity <time className="mono">{timestamp(d.last_seen)}</time></span><span>Observed snapshot <time className="mono">{timestamp(d.observed_at)}</time></span></div>
      <Panel title="Shared time window" description="Traffic, DNS and blocked-connection lanes share one axis. Markers show recorded bindings and events; markers are correlation, not cause.">
        <RequestState resource={summary}>{s => <TimeWindowLanes lanes={s.series || []} markers={markers} from={window_.from} to={window_.to} onSelect={(from, to) => { filters.set('from', from); filters.set('to', to); }} />}</RequestState>
      </Panel>
      <Tabs items={tabs} selected={tab} onSelect={value => filters.set('tab', value)} />
      <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack" data-od-id={`device-window-${tab}`}>
        {tab === 'conversations' && <Panel title="Conversations in window" description="Recorded flows attributed with bindings valid at the time.">
          {viewer ? <AccessDeniedNotice /> : <RequestState resource={flows}>{fdata => <>
            {fdata.next_cursor && <OverflowNotice shown={(fdata.items || []).length} limit={50} action={<button className="btn" onClick={() => filters.set('cursor', fdata.next_cursor!)}>Next 50 records</button>} />}
            <FlowTable flows={fdata.items || []} onInspect={flow => { const ref = (flow as FlowWithRef).observation_ref; if (ref) filters.set('observation', ref); }} />
          </>}</RequestState>}
        </Panel>}
        {tab === 'dns' && <Panel title="DNS in window" description="Resolver observations for this device's recorded bindings.">
          {viewer ? <AccessDeniedNotice detail="DNS observations require the Operator or Administrator role." /> : <RequestState resource={dns}>{ddata => <DnsTable records={ddata.items || []} onInspect={ref => filters.set('observation', ref)} />}</RequestState>}
        </Panel>}
        {tab === 'history' && <>
          <Panel title="Address-binding history"><AddressTable addresses={data.bindings || d.addresses || []} /></Panel>
          <Panel title="Events in window"><RequestState resource={events}>{edata => <LinkedEventsTimeline events={edata.items || []} onInspectObservation={ref => filters.set('observation', ref)} />}</RequestState></Panel>
        </>}
      </section>
      {observationRef && !viewer && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
      {observationRef && viewer && <AccessDeniedNotice />}
      {!flows.data && !flows.loading && !viewer && tab === 'conversations' && <Empty title="Conversation evidence unavailable" />}
    </>;
  }}</RequestState>;
}
