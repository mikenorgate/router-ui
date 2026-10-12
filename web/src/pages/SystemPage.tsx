import type { SystemInfo } from '../types';
import { useAuth } from '../auth';
import { bytes, number, sampling, timestamp } from '../lib/format';
import { useFilters, useResource } from '../lib/hooks';
import { Badge, Status } from '../components/Badge';
import { SourceTable } from '../components/SourceTable';
import { Empty, Fields, PageHeader, Panel, RequestState } from '../components/UI';
export function SystemPage() {
  const resource = useResource<SystemInfo>('/system');
  const { session } = useAuth();
  const { params } = useFilters();
  return <><PageHeader title="System" description="Console storage, collection capabilities, management listeners, and access."><button className="btn" onClick={resource.reload}>Refresh system</button></PageHeader><RequestState resource={resource}>{data => {
    const storage = data.storage;
    const ratio = storage?.used_bytes != null && storage.budget_bytes != null && storage.budget_bytes > 0 ? storage.used_bytes / storage.budget_bytes : null;
    const selected = params.get('source');
    return <div className="stack"><div className="two"><Panel title="Bounded local storage" description="Collection and retention remain independent of forwarding."><Fields items={[
      ['Used / budget', <span className="mono">{bytes(storage?.used_bytes)} / {bytes(storage?.budget_bytes)}</span>], ['Raw retention', `${number(storage?.raw_days)} days`], ['History retention', `${number(storage?.history_days)} days`], ['Sampling', sampling(storage?.sampling_rate)],
    ]} />{ratio !== null && <><progress className="storage-budget" max={1} value={Math.min(1, Math.max(0, ratio))} aria-label="Storage budget used" /><p className="mono small">{number(ratio * 100)}% of storage budget</p></>}<p className="callout">CPU, memory and query budgets are unavailable in this API contract. Retention windows alone do not prove continuous coverage.</p></Panel><Panel title="Console and authentication"><Fields items={[
      ['Version', <span className="mono">{data.version || 'Unavailable'}</span>], ['Mode', data.mode || 'Unavailable'], ['Signed-in role', session?.user.role], ['OIDC provider', data.auth?.oidc_enabled == null ? 'Configuration unavailable' : data.auth.oidc_enabled ? 'Enabled · provider health not supplied' : 'Disabled'], ['Local recovery', data.auth?.local_recovery == null ? 'Configuration unavailable' : data.auth.local_recovery ? 'Enabled' : 'Disabled'],
    ]} /><p className="callout">Console sign-in does not change device firewall access.</p></Panel></div><Panel title="Sources and observation gaps" description="Freshness, sampling, loss and sequences are shown as reported.">{selected && <p className="notice">Selected source: <span className="mono">{selected}</span></p>}<SourceTable sources={selected ? (data.sources || []).filter(s => s.id === selected) : data.sources || []} /></Panel><Panel title="Local capabilities"><div className="capabilities">{data.capabilities?.length ? data.capabilities.map(cap => <article key={cap.id}><strong className="mono">{cap.id}</strong><Badge tone={cap.supported ? 'plain' : 'unknown'}>{cap.supported == null ? 'Support unknown' : cap.supported ? 'Supported' : 'Unsupported'}</Badge><p>{cap.reason || 'Coverage reason unavailable'}</p></article>) : <Empty title="Capability manifest unavailable" />}</div></Panel><div className="two"><Panel title="Management listeners" description="Configured listeners do not prove external reachability.">{data.listeners?.length ? <Fields items={data.listeners.map((listener, i) => [`Listener ${i + 1}`, <><span className="mono">{listener.address || 'Address unavailable'}</span> <Status value={listener.status} /></>])} /> : <Empty title="No listeners reported" />}</Panel><Panel title="Certificates">{data.certificates?.length ? <div className="certificate-list">{data.certificates.map((certificate, i) => <Fields key={i} items={[
      ['Names', certificate.names?.join(', ') || 'Unavailable'], ['Expires', <span className="mono">{timestamp(certificate.expires_at)}</span>], ['Status', <Status value={certificate.status} />],
    ]} />)}</div> : <Empty title="Certificate information unavailable" />}</Panel></div></div>;
  }}</RequestState></>;
}
