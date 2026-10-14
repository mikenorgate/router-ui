// Direct-link observation inspector. The record is resolved by opaque
// reference through GET /api/v1/observations/{ref}, so the inspector works for
// a record outside the current list page, cursor position, or time window.
// Reference identity (source/boot/kind/record) stays visible at the top.
import { Link } from 'react-router-dom';
import type { DnsObservation, Observation } from '../lib/contracts';
import type { ConsoleEvent, Flow } from '../types';
import { bytes, endpoint, sampling, text, timestamp } from '../lib/format';
import { observationPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { Badge, Status } from './Badge';
import { Inspector } from './Inspector';
import { Fields, RequestState } from './UI';

export function ObservationInspector({ reference, onClose }: { reference: string; onClose: () => void }) {
  const resource = useResource<Observation>(observationPath(reference));
  return <Inspector title={`Observation ${reference}`} onClose={onClose}>
    <RequestState resource={resource}>{observation => <ObservationBody observation={observation} />}</RequestState>
  </Inspector>;
}

function ObservationBody({ observation }: { observation: Observation }) {
  const { href } = useFilters();
  const { identity } = observation;
  const investigation = observation.links?.find(link => link.rel === 'investigation');
  return <div className="stack" data-od-id="observation-body">
    <Fields items={[
      ['Record kind', <Badge tone="plain">{identity.kind}</Badge>],
      ['Observation source', <span className="mono">{identity.source_kind || 'Kind unavailable'} · {identity.source_id}</span>],
      ['Router boot', <span className="mono">{identity.boot_id || 'Boot identity unavailable'}</span>],
      ['Producer record', <span className="mono">{identity.record_id || 'Record identity unavailable'}</span>],
      ['Recorded at', <time className="mono">{timestamp(identity.recorded_at)}</time>],
    ]} />
    {observation.evidence && <p className="callout">{observation.evidence}</p>}
    {observation.restrictions?.map((note, index) => <p key={index} className="callout">{note}</p>)}
    <RecordFields observation={observation} />
    {(observation.links?.length || investigation) && <div className="event-links" data-od-id="observation-links">
      {observation.links?.filter(link => link.rel !== 'investigation').map(link => <Link key={`${link.rel}-${link.href}`} to={href(link.href)}>{link.label}</Link>)}
      {investigation && <Link className="btn" to={href(investigation.href)} data-od-id="explain-access-link">{investigation.label} ↗</Link>}
    </div>}
  </div>;
}

function RecordFields({ observation }: { observation: Observation }) {
  const record = observation.record;
  if (!record) return <p className="callout">Record payload unavailable; only its identity is retained.</p>;
  if (observation.identity.kind === 'flow') {
    const flow = record as Flow;
    return <Fields items={[
      ['Original tuple', <span className="mono">{endpoint(flow.source_ip, flow.source_port)} → {endpoint(flow.destination_ip, flow.destination_port)} · {flow.protocol || 'Protocol unknown'}</span>],
      ['Verdict', <Status value={flow.verdict || 'unknown'} />],
      ['Sent / received', <span className="mono">{bytes(flow.bytes_sent)} / {bytes(flow.bytes_received)}</span>],
      ['First / last seen', <span className="mono">{timestamp(flow.started_at)} / {timestamp(flow.last_seen)}</span>],
      ['Sampling', sampling(flow.sampling_rate)],
      ['Recorded rule', flow.rule_id ? <span className="mono">{flow.rule_id}</span> : 'No attributed rule recorded'],
    ]} />;
  }
  if (observation.identity.kind === 'dns') {
    const dns = record as DnsObservation;
    return <Fields items={[
      ['Query', <span className="mono">{text(dns.query_name, 'Name unobserved')} · {text(dns.query_type, 'Type unavailable')}</span>],
      ['Result', <Status value={dns.rcode || 'unknown'} />],
      ['Resolver / latency', <span>{text(dns.resolver)} · {dns.latency_ms == null ? 'Latency unavailable' : `${dns.latency_ms} ms`}</span>],
      ['Observed at', <time className="mono">{timestamp(dns.observed_at)}</time>],
      ['Evidence', dns.evidence || 'Association evidence unavailable'],
    ]} />;
  }
  if (observation.identity.kind === 'event') {
    const event = record as ConsoleEvent;
    return <Fields items={[
      ['Event', event.title || 'Recorded event'],
      ['Severity / kind', <><Status value={event.severity} /> <span className="mono">{text(event.kind)}</span></>],
      ['Time', <time className="mono">{timestamp(event.time)}</time>],
      ['Detail', event.detail || 'Event detail unavailable'],
    ]} />;
  }
  return <p className="callout mono">{JSON.stringify(record)}</p>;
}
