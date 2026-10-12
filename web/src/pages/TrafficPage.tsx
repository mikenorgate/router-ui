import type { Collection, Flow } from '../types';
import { useAuth } from '../auth';
import { query } from '../lib/api';
import { filterFlows } from '../lib/filters';
import { useFilters, useResource } from '../lib/hooks';
import { ExportButton } from '../components/ExportButton';
import { FlowDetail, FlowTable } from '../components/FlowTable';
import { Inspector } from '../components/Inspector';
import { Empty, FilterSelect, PageHeader, Panel, Permission, RequestState, SearchFilter } from '../components/UI';
export function TrafficPage() {
  const filters = useFilters();
  const { session } = useAuth();
  const viewer = session?.user.role === 'viewer';
  const q = filters.params.get('q') || '';
  const deviceId = filters.params.get('device_id');
  const resource = useResource<Collection<Flow>>(viewer ? null : query('/flows', { q, device_id: deviceId, limit: '50', cursor: filters.params.get('cursor'), range: filters.params.get('range'), from: filters.params.get('from'), to: filters.params.get('to'), verdict: filters.params.get('verdict'), protocol: filters.params.get('protocol'), family: filters.params.get('family'), translation: filters.params.get('translation') }));
  const selected = resource.data?.items?.find(f => f.id === filters.params.get('flow'));
  return <><PageHeader title="Traffic" description="Investigate recorded conversations, address translation, and attributed verdicts."><ExportButton deviceId={deviceId} /></PageHeader>{viewer ? <Permission /> : <Panel title="Flow browser" description="Queries are bounded to 50 records. Traffic filters apply before pagination; returned evidence stays bounded."><div className="filterbar"><SearchFilter value={q} onChange={value => filters.set('q', value)} hint="Address, domain, protocol or rule" /><label className="control-label"><span>Device ID</span><input key={deviceId || ''} className="input" defaultValue={deviceId || ''} onBlur={e => { if (e.target.value !== (deviceId || '')) filters.set('device_id', e.target.value.trim().slice(0, 128)); }} onKeyDown={e => { if (e.key === 'Enter') filters.set('device_id', e.currentTarget.value.trim().slice(0, 128)); }} maxLength={128} /></label>
    <FilterSelect label="Verdict" value={filters.params.get('verdict') || ''} onChange={value => filters.set('verdict', value)} options={[["", 'All verdicts'], ['allowed', 'Allowed'], ['blocked', 'Blocked'], ['unknown', 'Unknown']]} />
    <FilterSelect label="Protocol" value={filters.params.get('protocol') || ''} onChange={value => filters.set('protocol', value)} options={[["", 'All protocols'], ['TCP', 'TCP'], ['UDP', 'UDP'], ['ICMP', 'ICMP'], ['ICMPV6', 'ICMPv6']]} />
    <FilterSelect label="Family" value={filters.params.get('family') || ''} onChange={value => filters.set('family', value)} options={[["", 'Both families'], ['4', 'IPv4'], ['6', 'IPv6']]} />
    <FilterSelect label="Translation" value={filters.params.get('translation') || ''} onChange={value => filters.set('translation', value)} options={[["", 'All records'], ['recorded', 'Translation recorded'], ['unrecorded', 'No translation recorded']]} /><button className="btn text" onClick={filters.clear}>Clear filters</button></div>
    <RequestState resource={resource}>{data => {
      const flowCapability = data.capabilities?.find(c => c.id === 'flow');
      const isUnsupported = flowCapability && flowCapability.supported === false;
      return <>{isUnsupported ? <Empty title="Flow collection unsupported" detail={flowCapability.reason || 'No local flow producer configured.'} /> : <FlowTable flows={filterFlows(data.items || [], filters.params)} selected={selected?.id} onInspect={flow => filters.set('flow', flow.id)} />}<div className="pagination"><button className="btn" onClick={resource.reload}>Refresh page</button>{filters.params.has('cursor') && <button className="btn" onClick={() => filters.set('cursor', '')}>First page</button>}{data.next_cursor && <button className="btn" onClick={() => filters.set('cursor', data.next_cursor!)}>Next 50 records</button>}</div></>;
    }}</RequestState>
  </Panel>}{selected && !viewer && <Inspector title={`Flow ${selected.id}`} onClose={() => filters.set('flow', '')}><FlowDetail flow={selected} /></Inspector>}{filters.params.has('flow') && !selected && !resource.loading && !viewer && <Empty title="Flow not in this page" detail="Selected flow is outside the bounded response. Return to the page containing this observation." action={<button className="btn" onClick={() => filters.set('flow', '')}>Close selection</button>} />}</>;
}
