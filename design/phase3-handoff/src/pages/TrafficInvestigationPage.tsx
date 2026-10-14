// Phase 3 Traffic page: flows/DNS tabs with server-applied filter controls
// and a direct-link observation inspector. The inspector resolves records by
// opaque reference, so a shared link opens a record even when it is outside
// the current bounded list page. DNS and flow detail are Operator-only.
import { useState } from 'react';
import { useAuth } from '../auth';
import type { Collection, Flow } from '../types';
import type { DnsObservation, FlowWithRef } from '../lib/contracts';
import { dnsPath, flowsPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { AccessDeniedNotice, OverflowNotice } from '../components/EvidenceNotices';
import { DnsTable } from '../components/DnsTable';
import { FlowDetail, FlowTable } from '../components/FlowTable';
import { Inspector } from '../components/Inspector';
import { ObservationInspector } from '../components/ObservationInspector';
import { ServerFilterBar } from '../components/ServerFilterBar';
import { ExportButton } from '../components/ExportButton';
import { Empty, PageHeader, Panel, RequestState } from '../components/UI';

const tabs = ['flows', 'dns'] as const;
type TrafficTab = typeof tabs[number];

const flowFilters = [
  { key: 'verdict', label: 'Verdict', options: [['', 'All verdicts'], ['allowed', 'Allowed'], ['blocked', 'Blocked'], ['unknown', 'Unknown']] as [string, string][] },
  { key: 'protocol', label: 'Protocol', options: [['', 'All protocols'], ['TCP', 'TCP'], ['UDP', 'UDP'], ['ICMP', 'ICMP'], ['ICMPV6', 'ICMPv6']] as [string, string][] },
  { key: 'family', label: 'Family', options: [['', 'Both families'], ['4', 'IPv4'], ['6', 'IPv6']] as [string, string][] },
  { key: 'translation', label: 'Translation', options: [['', 'All records'], ['recorded', 'Translation recorded'], ['unrecorded', 'No translation recorded']] as [string, string][] },
];
const dnsFilters = [
  { key: 'rcode', label: 'Result', options: [['', 'All results'], ['NOERROR', 'NOERROR'], ['NXDOMAIN', 'NXDOMAIN'], ['SERVFAIL', 'SERVFAIL']] as [string, string][] },
];

export function TrafficInvestigationPage() {
  const filters = useFilters();
  const { session } = useAuth();
  const viewer = session?.user.role === 'viewer';
  const selectedTab = filters.params.get('tab') || 'flows';
  const tab: TrafficTab = (tabs as readonly string[]).includes(selectedTab) ? selectedTab as TrafficTab : 'flows';
  const window_ = { range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to') };
  const limit = '50';
  const flowsResource = useResource<Collection<FlowWithRef>>(viewer || tab !== 'flows' ? null : flowsPath({
    ...window_, q: filters.params.get('q'), device_id: filters.params.get('device_id'),
    verdict: filters.params.get('verdict'), protocol: filters.params.get('protocol'),
    family: filters.params.get('family'), translation: filters.params.get('translation'),
    limit, cursor: filters.params.get('cursor'),
  }));
  const dnsResource = useResource<Collection<DnsObservation>>(viewer || tab !== 'dns' ? null : dnsPath({
    ...window_, q: filters.params.get('q'), device_id: filters.params.get('device_id'),
    rcode: filters.params.get('rcode'), limit, cursor: filters.params.get('cursor'),
  }));
  const observationRef = filters.params.get('observation');
  const legacyFlow = filters.params.get('flow');
  const [legacyDetail, setLegacyDetail] = useState<Flow | null>(null);

  return <>
    <PageHeader title="Traffic" description="Recorded conversations and resolver observations. Filters apply on the router before pagination."><ExportButton deviceId={filters.params.get('device_id')} /></PageHeader>
    <div className="tabs" role="tablist" aria-label="Traffic views" data-od-id="traffic-tabs">
      {tabs.map((item, index) => <button key={item} className="tab" id={`tab-${item}`} role="tab" aria-selected={tab === item} aria-controls={`panel-${tab}`} tabIndex={tab === item ? 0 : -1}
        onClick={() => filters.set('tab', item)}
        onKeyDown={event => {
          const offset = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
          const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : offset ? (index + offset + tabs.length) % tabs.length : null;
          if (next !== null) { event.preventDefault(); const target = tabs[next]!; filters.set('tab', target); document.getElementById(`tab-${target}`)?.focus(); }
        }}>{item === 'flows' ? 'Flows' : 'DNS'}</button>)}
    </div>
    <section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack">
      {viewer ? <AccessDeniedNotice /> : tab === 'flows' ? (
        <Panel title="Flow browser" description="Bounded to 50 records per request. Verdicts are attributed observations; an unknown verdict stays unknown.">
          <ServerFilterBar searchLabel="Search flows" searchHint="Address, name, protocol or rule" filters={flowFilters} values={filters.params} onChange={filters.set} onClear={filters.clear} />
          <RequestState resource={flowsResource}>{data => {
            const items = data.items || [];
            return <>
              {data.next_cursor && <OverflowNotice shown={items.length} limit={50} action={<button className="btn" onClick={() => filters.set('cursor', data.next_cursor!)}>Next 50 records</button>} />}
              <FlowTable flows={items} selected={legacyFlow} onInspect={flow => { const ref = (flow as FlowWithRef).observation_ref; if (ref) filters.set('observation', ref); else { setLegacyDetail(flow); filters.set('flow', flow.id); } }} />
              <div className="pagination"><button className="btn" onClick={flowsResource.reload}>Refresh page</button>{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}</div>
            </>;
          }}</RequestState>
        </Panel>
      ) : (
        <Panel title="DNS observations" description="Resolver metadata with association age. Names do not identify applications; encrypted DNS limits classification.">
          <ServerFilterBar searchLabel="Search DNS" searchHint="Query name, type or device" filters={dnsFilters} values={filters.params} onChange={filters.set} onClear={filters.clear} />
          <RequestState resource={dnsResource}>{data => <>
            {data.next_cursor && <OverflowNotice shown={(data.items || []).length} limit={50} action={<button className="btn" onClick={() => filters.set('cursor', data.next_cursor!)}>Next 50 records</button>} />}
            <DnsTable records={data.items || []} onInspect={ref => filters.set('observation', ref)} />
            <div className="pagination"><button className="btn" onClick={dnsResource.reload}>Refresh page</button>{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}</div>
          </>}</RequestState>
        </Panel>
      )}
    </section>
    {observationRef && !viewer && <ObservationInspector reference={observationRef} onClose={() => filters.set('observation', '')} />}
    {observationRef && viewer && <AccessDeniedNotice detail="This observation reference resolves to detail that requires the Operator or Administrator role." />}
    {legacyDetail && !observationRef && <Inspector title={`Flow ${legacyDetail.id}`} onClose={() => { setLegacyDetail(null); filters.set('flow', ''); }}><FlowDetail flow={legacyDetail} /></Inspector>}
    {legacyFlow && !legacyDetail && !observationRef && !viewer && <Empty title="Flow reference unavailable" detail="This record predates observation references. Re-query the window to resolve its evidence." action={<button className="btn" onClick={() => filters.set('flow', '')}>Close selection</button>} />}
  </>;
}
