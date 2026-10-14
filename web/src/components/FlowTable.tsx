import { Link } from 'react-router-dom';
import type { Flow } from '../types';
import { bytes, endpoint, sampling, timestamp } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Status } from './Badge';
import { DataTable } from './DataTable';
import { Fields } from './UI';

export function FlowTable({ flows, onInspect, selected }: { flows: Flow[]; onInspect: (flow: Flow) => void; selected?: string | null }) {
  const { href } = useFilters();
  return <DataTable rows={flows} selected={selected} caption="Recorded conversations. Destination labels come from supplied metadata; ports do not identify applications. Bytes are recorded values, not extrapolated totals." columns={[
    { key: 'source', label: 'Source / device', sort: f => f.source_ip, render: f => <><span className="mono">{endpoint(f.source_ip, f.source_port)}</span>{f.device_id && <Link className="sub" to={href(`/devices/${encodeURIComponent(f.device_id)}`)}>{f.device_id}</Link>}</> },
    { key: 'destination', label: 'Destination', sort: f => f.destination_name || f.destination_ip, render: f => <><span className="mono">{endpoint(f.destination_ip, f.destination_port)}</span><span className="sub">{f.destination_name || 'Name unobserved'}</span></> },
    { key: 'protocol', label: 'Protocol / evidence', sort: f => f.protocol, render: f => <><span className="mono">{f.protocol || 'Unknown'}</span><span className="sub">{sampling(f.sampling_rate)}</span>{f.observation_point && <span className="sub mono">{[f.namespace, f.zone, f.observation_point].filter(Boolean).join(' · ')}</span>}</> },
    { key: 'bytes', label: 'Sent / received', sort: f => f.bytes_received, render: f => <span className="mono">{bytes(f.bytes_sent)} / {bytes(f.bytes_received)}</span> },
    { key: 'verdict', label: 'Verdict / state', sort: f => f.verdict, render: f => <><Status value={f.verdict || 'unknown'} /><span className="sub mono">{f.state ? `State: ${f.state}` : 'State unrecorded'} · {timestamp(f.last_seen)}</span></> },
    { key: 'details', label: 'Details', render: f => <button className="btn text" onClick={() => onInspect(f)} aria-label={`Inspect flow ${f.id}`}>Inspect ↗</button> },
  ]} />;
}
export function FlowDetail({ flow: f }: { flow: Flow }) {
  const { href } = useFilters();
  const translation = !!(f.translated_source_ip || f.translated_destination_ip || f.translated_source_port != null || f.translated_destination_port != null);
  return <div className="stack"><Status value={f.verdict || 'unknown'} /><Fields items={[
    ['Flow ID', <span className="mono">{f.id}</span>], ['Original tuple', <span className="mono">{endpoint(f.source_ip, f.source_port)} → {endpoint(f.destination_ip, f.destination_port)} · {f.protocol || 'Protocol unknown'}</span>],
    ['Translated tuple', translation
      ? <span className="mono">{endpoint(f.translated_source_ip, f.translated_source_port)} → {endpoint(f.translated_destination_ip, f.translated_destination_port)}<span className="sub">Translated addresses and ports render only as recorded.</span></span>
      : 'No translation recorded; none is inferred.'],
    ['Record state', f.state ? <Status value={f.state} /> : 'State unrecorded'],
    ['Observation point', <span className="mono">{[f.namespace, f.zone, f.observation_point].filter(Boolean).join(' · ') || 'Namespace, zone or observation point unrecorded'}</span>],
    ['Device association', f.device_id ? <Link to={href(`/devices/${encodeURIComponent(f.device_id)}`, { tab: 'addresses' })}>{f.device_id} · inspect address-binding history</Link> : 'Device attribution unavailable'],
    ['First / last seen', <span className="mono">{timestamp(f.started_at)} / {timestamp(f.last_seen)}</span>], ['Sent / received', <span className="mono">{bytes(f.bytes_sent)} / {bytes(f.bytes_received)}</span>],
    ['Sampling', sampling(f.sampling_rate)], ['Evidence', f.evidence || 'Attribution evidence unavailable'], ['Observation source', f.source_id ? <Link to={href('/system', { source: f.source_id })}>{f.source_id}</Link> : 'Source unavailable'],
    ['Recorded rule', f.rule_id ? <Link to={href('/firewall', { rule: f.rule_id })}>Inspect {f.rule_id} provenance</Link> : 'No attributed rule recorded'],
    ['Binding at first observation', f.binding ? <span className="mono">{f.binding.address} · {timestamp(f.binding.valid_from)} → {f.binding.valid_until ? timestamp(f.binding.valid_until) : 'End not recorded'} · {f.binding.source || 'Source unavailable'}</span> : 'Binding details unavailable'],
    ['Policy revision / binding', <span className="mono">{f.policy_revision || 'Revision unrecorded'} · {f.binding_ref || 'Binding reference unrecorded'}</span>],
    ['Hook path', 'Not supplied by this API. Installed rule metadata does not establish the traversed hook path.'], ['Application connectivity', 'Unknown · no application-level evidence supplied'],
  ]} /><p className="callout">An unknown verdict stays unknown. Device association must use bindings valid at the observation time.</p></div>;
}
