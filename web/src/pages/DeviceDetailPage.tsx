import { useEffect, useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../auth';
import type { Address, DeviceDetail, Policy, Collection } from '../types';
import { timestamp, text } from '../lib/format';
import { useFilters, useResource } from '../lib/hooks';
import { request } from '../lib/api';
import { Status } from '../components/Badge';
import { AnnotationEditor } from '../components/AnnotationEditor';
import { DataTable } from '../components/DataTable';
import { EventTimeline } from '../components/EventTimeline';
import { FlowDetail, FlowTable } from '../components/FlowTable';
import { Inspector } from '../components/Inspector';
import { PolicyTable, RuleDetail } from '../components/PolicyTable';
import { SourceTable } from '../components/SourceTable';
import { Empty, Fields, PageHeader, Panel, Permission, RequestState, Tabs } from '../components/UI';
const tabs = ['summary', 'traffic', 'firewall', 'addresses', 'history'];

export function PoliciesPanel({ deviceId, initialPolicies, extraPolicies, nextCursor, selectedRule, onInspect, onLoadedMore, staleError, reconciling }: { deviceId: string; initialPolicies: Policy[]; extraPolicies: Policy[]; nextCursor: string | null; selectedRule: string | null; onInspect: (p: Policy) => void; onLoadedMore: (p: Policy[], cursor: string | null) => void; staleError?: Error | null; reconciling?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const currentDeviceRef = useRef(deviceId);
  useEffect(() => { currentDeviceRef.current = deviceId; }, [deviceId]);

  const loadMore = async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    const requestedDevice = deviceId;
    try {
      const res = await request<Collection<Policy>>(`/policies?device_id=${encodeURIComponent(requestedDevice)}&cursor=${encodeURIComponent(nextCursor)}`);
      if (currentDeviceRef.current !== requestedDevice) return; // device changed
      onLoadedMore(res.items || [], res.next_cursor || null);
    } catch (e) {
      if (currentDeviceRef.current !== requestedDevice) return;
      console.error('Failed to load more policies', e);
      setError(e instanceof Error ? e : new Error('Failed to load more policies'));
    } finally {
      if (currentDeviceRef.current === requestedDevice) setLoading(false);
    }
  };

  const map = new Map(initialPolicies.map(p => [p.id, p]));
  const dedupedExtra = extraPolicies.filter(p => !map.has(p.id));
  const combined = [...initialPolicies, ...dedupedExtra];

  return <Panel title="Policy affecting this device" description="Scope and conditions determine applicability. Shared counters do not prove a device match.">
    <PolicyTable policies={combined} selected={selectedRule} onInspect={onInspect} />
    {(error || staleError) && <div style={{ marginTop: '16px', color: 'var(--danger)', textAlign: 'center' }}>{(error || staleError)?.message} <button className="btn" onClick={loadMore} style={{ marginLeft: '8px' }}>Retry</button></div>}
    {nextCursor && !error && !staleError && <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}><button className="btn" onClick={loadMore} disabled={loading || reconciling}>{loading || reconciling ? 'Loading...' : 'Load more policies'}</button></div>}
  </Panel>;
}

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
  const resource = useResource<DeviceDetail>(`/devices/${encodeURIComponent(id)}`, { autoRefresh: !filters.params.has('from') });
  const [extraPolicies, setExtraPolicies] = useState<Policy[]>([]);
  const [extraCursor, setExtraCursor] = useState<string | null>(null);
  const [pagesLoaded, setPagesLoaded] = useState(0);
  const [reconcileError, setReconcileError] = useState<Error | null>(null);
  const [reconciling, setReconciling] = useState(false);

  useEffect(() => {
    setExtraPolicies([]);
    setExtraCursor(null);
    setPagesLoaded(0);
    setReconcileError(null);
  }, [id]);

  return <RequestState resource={resource}>{data => {
    const d = data.device;
    const restricted = data.detail_restricted || session?.user.role === 'viewer';
    const flow = restricted ? undefined : data.flows?.find(f => f.id === filters.params.get('flow'));

    // Dedupe
    const initialMap = new Map((data.policies || []).map(p => [p.id, p]));
    const dedupedExtra = extraPolicies.filter(p => !initialMap.has(p.id));
    const allPolicies = [...(data.policies || []), ...dedupedExtra];
    const rule = allPolicies.find(p => p.id === filters.params.get('rule'));

    const effectiveNextCursor = extraCursor !== null ? (extraCursor === 'done' ? null : extraCursor) : (data.policies_next_cursor || null);

    const observedAt = data.device.observed_at;
    const initialNextCursor = data.policies_next_cursor;
    useEffect(() => {
      if (!observedAt) return;
      if (pagesLoaded > 0) {
        setReconciling(true);
        setReconcileError(null);
        let cancelled = false;
        const doFetch = async () => {
          let currentCursor = initialNextCursor;
          let fetchedPolicies: Policy[] = [];
          let count = 0;
          try {
            while (count < pagesLoaded && currentCursor) {
              if (cancelled) return;
              const res = await request<Collection<Policy>>(`/policies?device_id=${encodeURIComponent(id)}&cursor=${encodeURIComponent(currentCursor)}`);
              fetchedPolicies = [...fetchedPolicies, ...(res.items || [])];
              currentCursor = res.next_cursor || null;
              count++;
            }
            if (!cancelled) {
              setExtraPolicies(fetchedPolicies);
              setExtraCursor(currentCursor || 'done');
              setPagesLoaded(count);
            }
          } catch (e) {
            if (!cancelled) {
              setReconcileError(e instanceof Error ? e : new Error('Failed to refresh policy pagination.'));
            }
          } finally {
            if (!cancelled) setReconciling(false);
          }
        };
        doFetch();
        return () => { cancelled = true; };
      }
    }, [observedAt, initialNextCursor, id, pagesLoaded]);

    const handleLoadedMore = (newPolicies: Policy[], newCursor: string | null) => {
      setExtraPolicies(prev => {
        const existingMap = new Map(prev.map(p => [p.id, p]));
        const novel = newPolicies.filter(p => !existingMap.has(p.id));
        return [...prev, ...novel];
      });
      setExtraCursor(newCursor || 'done');
      setPagesLoaded(p => p + 1);
    };
    return <><PageHeader title={data.annotation?.alias || d.name || 'Unnamed device'} description={`${d.segment || 'Segment unavailable'} · ${d.mac || 'MAC unavailable'}`} parent="Devices"><Link className="btn" to={filters.href('/devices')}>Back to devices</Link><Status value={d.status} /></PageHeader><div className="device-context"><span>Last activity <time className="mono">{timestamp(d.last_seen)}</time></span><span>Observed snapshot <time className="mono">{timestamp(d.observed_at)}</time></span></div><Tabs items={tabs} selected={tab} onSelect={value => filters.set('tab', value)} /><section id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`} className="stack" data-od-id={`device-${tab}`}>
      {tab === 'summary' && <><div className="two"><Panel title="Observed identity"><Fields items={[
        ['Device ID', <span className="mono">{d.id}</span>], ['Segment', d.segment], ['MAC', <span className="mono">{d.mac || 'Unavailable'}</span>], ['Presence', <Status value={d.status} />], ['Current associations', d.addresses?.map(a => <span key={a.address} className="address-line mono">{a.address}</span>) || 'No associations recorded'],
      ]} /><p className="callout">A stale lease or sleeping device does not prove disconnection.</p><Link to={filters.href(`/devices/${encodeURIComponent(id)}`, { tab: 'addresses' })}>Address-binding history ↗</Link></Panel><Panel title="Console annotations"><AnnotationEditor key={id} deviceId={id} alias={data.annotation?.alias} note={data.annotation?.note} onSaved={resource.reload} /></Panel></div><Panel title="Recent conversations" description="Recorded values only; shared interface counters are not device totals." action={<Link to={filters.href('/traffic', { device_id: id })}>Investigate traffic ↗</Link>}>{restricted ? <Permission /> : <FlowTable flows={data.flows || []} onInspect={f => filters.set('flow', f.id)} />}</Panel><Panel title="Device sources"><SourceTable sources={d.sources || []} /></Panel><Panel title="Related events"><EventTimeline events={data.events || []} /></Panel></>}
      {tab === 'traffic' && <Panel title="Device traffic" action={<Link to={filters.href('/traffic', { device_id: id })}>Full flow browser ↗</Link>}>{restricted ? <Permission /> : <FlowTable flows={data.flows || []} selected={flow?.id} onInspect={f => filters.set('flow', f.id)} />}</Panel>}
      {tab === 'firewall' && <PoliciesPanel deviceId={id} initialPolicies={data.policies || []} extraPolicies={extraPolicies} nextCursor={effectiveNextCursor} selectedRule={rule?.id || null} onInspect={p => filters.set('rule', p.id)} onLoadedMore={handleLoadedMore} staleError={reconcileError} reconciling={reconciling} />}
      {tab === 'addresses' && <Panel title="Address-binding history"><AddressTable addresses={data.bindings || d.addresses || []} /></Panel>}
      {tab === 'history' && <Panel title="Device history" description="Correlated changes are evidence for investigation, not demonstrated causes."><EventTimeline events={data.events || []} /></Panel>}
    </section>{flow && <Inspector title={`Flow ${flow.id}`} onClose={() => filters.set('flow', '')}><FlowDetail flow={flow} /></Inspector>}{rule && <Inspector title={`Rule ${rule.id}`} onClose={() => filters.set('rule', '')}><RuleDetail policy={rule} /></Inspector>}{filters.params.has('flow') && !flow && <Empty title={data.detail_restricted ? 'Flow detail restricted' : 'Flow not in this response'} detail="The selected flow may be outside this bounded device response." />}</>;
  }}</RequestState>;
}
