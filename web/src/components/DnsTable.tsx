// DNS observation table. Names arrive from resolver or protocol metadata with
// their association and age visible; encrypted DNS limits classification, and
// neither a name nor a port identifies an application. Answer values and TTLs
// render as recorded (backend shape; legacy fixture aliases fall back), never
// reduced to a bare count. Viewer sessions keep the redacted permission state.
import { Link } from 'react-router-dom';
import type { DnsObservation } from '../lib/contracts';
import { dnsQuery, dnsResult, dnsType } from '../lib/dns';
import { number, sampling, text, timestamp } from '../lib/format';
import { useFilters } from '../lib/hooks';
import { Status, toneFor } from './Badge';
import { Badge } from './Badge';
import { DataTable } from './DataTable';
import { DnsAnswers } from './DnsAnswers';
import { Permission } from './UI';

export function DnsTable({ records, onInspect, restricted = false }: {
  records: DnsObservation[];
  onInspect?: (ref: string) => void;
  restricted?: boolean;
}) {
  const { href } = useFilters();
  if (restricted) return <Permission detail="DNS observations require the Operator or Administrator role." />;
  return <DataTable rows={records} caption="Recorded resolver observations. Query names are resolver metadata with visible association age; they do not identify applications, and NXDOMAIN is a resolver answer, not a policy verdict." empty="No DNS observations in this window" columns={[
    { key: 'query', label: 'Query', sort: d => dnsQuery(d), render: d => <><span className="mono">{text(dnsQuery(d), 'Name unobserved')}</span><span className="sub mono">{text(dnsType(d), 'Type unavailable')}</span></> },
    { key: 'result', label: 'Result / answers', sort: d => dnsResult(d), render: d => {
      const result = dnsResult(d);
      return <><Badge tone={toneFor(result === 'NOERROR' ? 'current' : result === 'NXDOMAIN' ? 'unknown' : result)}>{text(result, 'Result unavailable')}</Badge><DnsAnswers record={d} /></>;
    } },
    { key: 'device', label: 'Device association', sort: d => d.device_id || d.client_ip, render: d => d.device_id
      ? <><Link to={href(`/devices/${encodeURIComponent(d.device_id)}`)}>{d.device_id}</Link>{d.client_ip && <span className="sub mono">client {d.client_ip}</span>}</>
      : d.client_ip ? <><span className="mono">{d.client_ip}</span><span className="sub">Device association unavailable</span></> : 'Association unavailable' },
    { key: 'resolver', label: 'Resolver / latency', sort: d => d.resolver, render: d => <><span>{text(d.resolver, 'Resolver unavailable')}</span><span className="sub mono">{d.latency_ms == null ? 'Latency unavailable' : `${number(d.latency_ms)} ms`}</span></> },
    { key: 'observed', label: 'Observed / sampling', sort: d => d.observed_at, render: d => <><time className="mono">{timestamp(d.observed_at)}</time><span className="sub">{sampling(d.sampling_rate)}</span></> },
    { key: 'details', label: 'Details', render: d => d.observation_ref && onInspect
      ? <button className="btn text" onClick={() => onInspect(d.observation_ref!)} aria-label={`Inspect DNS observation ${d.id}`}>Inspect ↗</button>
      : <Status value="Reference unavailable" /> },
  ]} />;
}
