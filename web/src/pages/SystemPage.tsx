import type { SystemInfo } from '../types';
import { useAuth } from '../auth';
import { bytes, number, sampling, timestamp } from '../lib/format';
import { useFilters, useResource } from '../lib/hooks';
import { Badge, Status } from '../components/Badge';
import { SourceTable } from '../components/SourceTable';
import { Empty, Fields, PageHeader, Panel, RequestState } from '../components/UI';
export function SystemPage() {
  const { session } = useAuth();
  const { params } = useFilters();
  const resource = useResource<SystemInfo>('/system', { autoRefresh: !params.has('from') });
  return <><PageHeader title="System" description="Console storage, collection capabilities, management listeners, and access."><button className="btn" onClick={resource.reload}>Refresh system</button></PageHeader><RequestState resource={resource}>{data => {
    const storage = data.storage;
    const ratio = storage?.used_bytes != null && storage.budget_bytes != null && storage.budget_bytes > 0 ? storage.used_bytes / storage.budget_bytes : null;
    const selected = params.get('source');
    return <div className="stack"><div className="two"><Panel title="Bounded local storage" description="Collection and retention remain independent of forwarding."><Fields items={[
      ['Used / budget', <span className="mono">{bytes(storage?.used_bytes)} / {bytes(storage?.budget_bytes)}</span>], ['Raw retention', `${number(storage?.raw_days)} days`], ['History retention', `${number(storage?.history_days)} days`], ['Sampling', sampling(storage?.sampling_rate)],
    ]} />{ratio !== null && <><progress className="storage-budget" max={1} value={Math.min(1, Math.max(0, ratio))} aria-label="Storage budget used" /><p className="mono small">{number(ratio * 100)}% of storage budget</p></>}<p className="callout">CPU, memory and query budgets are unavailable in this API contract. Retention windows alone do not prove continuous coverage.</p></Panel><Panel title="Console and authentication"><Fields items={[
      ['Console version', <span className="mono">{data.version || 'Unavailable'}</span>], ['Mode', data.mode || 'Unavailable'], ['Signed-in role', session?.user.role], ['OIDC provider', data.auth?.oidc_enabled == null ? 'Configuration unavailable' : data.auth.oidc_enabled ? 'Enabled · provider health not supplied' : 'Disabled'], ['Local recovery', data.auth?.local_recovery == null ? 'Configuration unavailable' : data.auth.local_recovery ? 'Enabled' : 'Disabled'],
    ]} /><p className="callout">Console sign-in does not change device firewall access.</p></Panel></div>
    <Panel title="Appliance infrastructure" description="Physical or virtual infrastructure metrics.">
      <Fields items={[
        ['Appliance ID', <span className="mono">{data.appliance?.id || 'Unavailable'}</span>],
        ['Image version', <span className="mono">{data.appliance?.image_version || 'Unavailable'}</span>],
        ['Boot ID', <span className="mono">{data.appliance?.boot_id || 'Unavailable'}</span>],
        ['Observed', data.appliance?.observed_at ? <time className="mono">{timestamp(data.appliance.observed_at)}</time> : 'Unavailable'],
        ['Clock sync', data.appliance?.clock_synchronized == null ? 'Unknown' : data.appliance.clock_synchronized ? 'Synchronized' : 'Unsynchronized']
      ]} />
      {data.appliance?.services?.length ? <div style={{ marginTop: '1rem' }}>
        <strong>Services</strong>
        <div className="certificate-list" style={{ marginTop: '0.5rem' }}>
          {data.appliance.services.map(s => <Fields key={s.name} items={[['Service', <span className="mono">{s.name}</span>], ['Status', <Status value={s.status} />]]} />)}
        </div>
      </div> : null}
      {data.appliance?.storage?.length ? <div style={{ marginTop: '1rem' }}>
        <strong>Appliance Volumes</strong>
        <div className="certificate-list" style={{ marginTop: '0.5rem' }}>
          {data.appliance.storage.map((v, i) => <Fields key={i} items={[
            ['Mount', <span className="mono">{v.mount}</span>],
            ['Available / Total', <span className="mono">{bytes(v.available_bytes)} / {bytes(v.total_bytes)}</span>]
          ]} />)}
        </div>
      </div> : null}
      {!data.appliance && <Empty title="Appliance info unavailable" />}
    </Panel>
    <Panel title="Sources and observation gaps" description="Freshness qualifies current metrics. A missing capability means no collection, not zero values.">{selected && <p className="notice">Selected source: <span className="mono">{selected}</span></p>}<SourceTable sources={selected ? (data.sources || []).filter(s => s.id === selected) : data.sources || []} /></Panel><Panel title="Local capabilities" description="Unsupported indicates no local producer (e.g. flow/DNS not collected)."><div className="capabilities">{data.capabilities?.length ? data.capabilities.map(cap => <article key={cap.id}><strong className="mono">{cap.id}</strong><Badge tone={cap.supported ? 'plain' : 'unknown'}>{cap.supported == null ? 'Support unknown' : cap.supported ? 'Supported' : 'Unsupported'}</Badge><p>{cap.reason || 'Coverage reason unavailable'}</p></article>) : <Empty title="Capability manifest unavailable" />}</div></Panel><div className="two"><Panel title="Management listeners" description="Configured listeners do not prove external reachability.">{data.listeners?.length ? <Fields items={data.listeners.map((listener, i) => [`Listener ${i + 1}`, <><span className="mono">{listener.address || 'Address unavailable'}</span> <Status value={listener.status} /></>])} /> : <Empty title="No listeners reported" />}</Panel><Panel title="Certificates">{data.certificates?.length ? <div className="certificate-list">{data.certificates.map((certificate, i) => <Fields key={i} items={[
      ['Names', certificate.names?.join(', ') || 'Unavailable'], ['Expires', <span className="mono">{timestamp(certificate.expires_at)}</span>], ['Status', <Status value={certificate.status} />],
    ]} />)}</div> : <Empty title="Certificate information unavailable" />}</Panel></div></div>;
  }}</RequestState></>;
}
