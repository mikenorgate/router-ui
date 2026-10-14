// Direct-link observation inspector. The record is resolved by opaque
// reference through GET /api/v1/observations/{ref}, so the inspector works for
// a record outside the current list page, cursor position, or time window.
// Reference identity (source/boot/kind/record) stays visible at the top.
import { Link } from 'react-router-dom';
import type { DnsObservation, Observation } from '../lib/contracts';
import type { ConsoleEvent, Flow } from '../types';
import { dnsQuery, dnsResult, dnsType } from '../lib/dns';
import { bytes, endpoint, sampling, text, timestamp } from '../lib/format';
import { observationPath } from '../lib/phase3Api';
import { useFilters, useResource } from '../lib/hooks';
import { Badge, Status } from './Badge';
import { DnsAnswers } from './DnsAnswers';
import { Inspector } from './Inspector';
import { Fields, RequestState } from './UI';

/** The backend serializes the conntrack zone as uint16; zone 0 is a valid
 * zone. Zero renders as an explicit "Zone 0" label so it is preserved instead
 * of dropped as falsy (or read as "unrecorded"); other values render as
 * recorded. */
const zoneText = (zone?: string | number) => zone === 0 ? 'Zone 0' : zone;

export function ObservationInspector({ reference, onClose }: { reference: string; onClose: () => void }) {
  const resource = useResource<Observation>(observationPath(reference));
  return <Inspector title={resource.data?.identity.record_id ? `Observation ${resource.data.identity.record_id}` : 'Observation'} onClose={onClose}>
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
    const translated = !!(flow.translated_source_ip || flow.translated_destination_ip || flow.translated_source_port != null || flow.translated_destination_port != null);
    return <Fields items={[
      ['Original tuple', <span className="mono">{endpoint(flow.source_ip, flow.source_port)} → {endpoint(flow.destination_ip, flow.destination_port)} · {flow.protocol || 'Protocol unknown'}</span>],
      ['Translated tuple', translated
        ? <span className="mono">{endpoint(flow.translated_source_ip, flow.translated_source_port)} → {endpoint(flow.translated_destination_ip, flow.translated_destination_port)}</span>
        : 'No translation recorded; none is inferred.'],
      ['Verdict', <Status value={flow.verdict || 'unknown'} />],
      ['Record state', flow.state ? <Status value={flow.state} /> : 'State unrecorded'],
      ['Observation point', <span className="mono">{[flow.namespace, zoneText(flow.zone), flow.observation_point].filter(part => part != null && part !== '').join(' · ') || 'Observation point unrecorded'}</span>],
      ['Sent / received', <span className="mono">{bytes(flow.bytes_sent)} / {bytes(flow.bytes_received)}</span>],
      ['First / last seen', <span className="mono">{timestamp(flow.started_at)} / {timestamp(flow.last_seen)}</span>],
      ['Sampling', sampling(flow.sampling_rate)],
      ['Recorded rule', flow.rule_id ? <span className="mono">{flow.rule_id}</span> : 'No attributed rule recorded'],
      ['Policy revision', flow.policy_revision ? <span className="mono">{flow.policy_revision}</span> : 'Revision unrecorded'],
      ['Address binding', flow.binding ? <span className="mono">{flow.binding.address} · {timestamp(flow.binding.valid_from)} → {flow.binding.valid_until ? timestamp(flow.binding.valid_until) : 'End not recorded'} · {flow.binding.source || 'Source unavailable'}</span> : flow.binding_ref ? <span className="mono">{flow.binding_ref}</span> : 'Binding reference unrecorded'],
    ]} />;
  }
  if (observation.identity.kind === 'dns') {
    const dns = record as DnsObservation;
    return <Fields items={[
      ['Query', <span className="mono">{text(dnsQuery(dns), 'Name unobserved')} · {text(dnsType(dns), 'Type unavailable')}</span>],
      ['Result', <Status value={dnsResult(dns) || 'unknown'} />],
      ['Answers', <DnsAnswers record={dns} verbose className="mono" />],
      ['Client', dns.client_ip ? <span className="mono">{dns.client_ip}</span> : 'Client address unrecorded'],
      ['Resolver / latency', <span>{text(dns.resolver)} · {dns.latency_ms == null ? 'Latency unavailable' : `${dns.latency_ms} ms`}</span>],
      ['Binding at observation time', dns.binding
        ? <span className="mono">{text(dns.binding.address, 'Address unrecorded')} · {timestamp(dns.binding.valid_from)} → {dns.binding.valid_until ? timestamp(dns.binding.valid_until) : 'End not recorded'} · {dns.binding.source || 'Source unavailable'}</span>
        : 'No binding recorded for this observation'],
      ['Query recorded at', <time className="mono">{timestamp(dns.query_at)}</time>],
      ['Transaction', <span className="mono">{dns.transaction_id || 'Transaction identity unavailable'}</span>],
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
