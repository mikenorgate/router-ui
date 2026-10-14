// Fictional Phase 3 fixtures and demo transport. handlePhase3Demo is wired
// into createDemo in ./demo.ts before the final 404 fallthrough and owns
// /flows, /dns and /export, so the fixture server applies the same
// server-side filters and role checks the contract describes.
// All records are fictional: documentation addresses (RFC 5737 / RFC 3849),
// example names, and a fixture boot identity. No site-specific identifiers.
import type { ConsoleEvent, Role } from '../types';
import { filterDns, filterFlows, interval } from './filters';
import { demoDevices, demoEvents, demoFlows, demoSources } from './demoData';
import type {
  AccessInvestigation, DnsObservation, Exposure, FlowWithRef,
  Observation, TrafficSummary,
} from './contracts';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
const BOOT = 'boot-example-7f2c';

export const phase3Flows: FlowWithRef[] = demoFlows.map((flow, index) => ({
  ...flow,
  observation_ref: `obs-flow-0${index + 1}`,
}));

// Record lifecycle, observation point and translation/revision detail as the
// backend Flow contract supplies them (policy_revision, binding_ref,
// translated ports). flow-01 is a decision-only record; flow-02 completed
// with recorded translation; flow-03 is still active with an unknown verdict.
Object.assign(phase3Flows[0]!, {
  state: 'decision', namespace: 'forwarding', zone: 'example-segment-a', observation_point: 'egress-interface',
  policy_revision: 'example-r42', binding_ref: 'binding-192-0-2-24',
});
Object.assign(phase3Flows[1]!, {
  state: 'completed', namespace: 'forwarding', zone: 'example-segment-a', observation_point: 'egress-interface',
  translated_source_port: 51024, translated_destination_port: 443,
  policy_revision: 'example-r8', binding_ref: 'binding-192-0-2-24',
});
Object.assign(phase3Flows[2]!, {
  state: 'active', namespace: 'forwarding', zone: 'example-segment-a', observation_point: 'egress-interface',
});

/** Events carrying the resolvable observation reference the timeline links to.
 * Only events with retained underlying records gain a reference. */
export const phase3Events: (ConsoleEvent & { observation_ref?: string })[] = demoEvents.map(event =>
  event.id === 'event-1' ? { ...event, observation_ref: 'obs-event-01' } : event);

// Backend-shaped records (query / type / result / answers as values, TTL
// answer records, client and binding) plus one legacy fixture-shaped record
// (dns-04) to keep the compatibility path exercised. Latency is nullable: an
// unmeasured latency stays unavailable and is never rendered as zero.
export const phase3Dns: DnsObservation[] = [
  { id: 'dns-01', device_id: 'device-a', query: 'service.example', type: 'A', result: 'NOERROR',
    answers: ['198.51.100.60', '198.51.100.61'], answer_count: 2, query_at: ago(7), transaction_id: 'example-txn-5520',
    answer_records: [
      { name: 'service.example', type: 'A', value: '198.51.100.60', ttl: 300 },
      { name: 'service.example', type: 'A', value: '198.51.100.61', ttl: 300 },
    ],
    client_ip: '192.0.2.24', binding: { device_id: 'device-a', address: '192.0.2.24', valid_from: ago(180), valid_until: null, source: 'Local lease' },
    resolver: 'router-local', latency_ms: 12, observed_at: ago(7), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Resolver metadata association, recorded at query time. Name does not identify the application.', observation_ref: 'obs-dns-01' },
  { id: 'dns-02', device_id: 'device-a', query: 'cdn.example', type: 'AAAA', result: 'NOERROR',
    answers: ['2001:db8:2::60'],
    answer_records: [{ name: 'cdn.example', type: 'AAAA', value: '2001:db8:2::60', ttl: 60 }],
    client_ip: '192.0.2.24', binding: { device_id: 'device-a', address: '192.0.2.24', valid_from: ago(180), valid_until: null, source: 'Local lease' },
    resolver: 'router-local', latency_ms: 18, observed_at: ago(9), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Shared hosting is expected; the name is not a destination identity.', observation_ref: 'obs-dns-02' },
  { id: 'dns-03', device_id: 'device-c', query: 'unresolved.example', type: 'A', result: 'NXDOMAIN', answers: [], answer_records: [],
    client_ip: '192.0.2.80', resolver: 'router-local', latency_ms: 41, observed_at: ago(12), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Negative answer recorded by the resolver; not a policy verdict.', observation_ref: 'obs-dns-03' },
  // Legacy fixture shape: aliases and a null count; latency unmeasured (null).
  { id: 'dns-04', device_id: 'device-b', query_name: 'updates.example', query_type: 'A', rcode: 'SERVFAIL', answers: null, resolver: 'upstream', latency_ms: null, observed_at: ago(90), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Upstream resolver failure, last observed 90 minutes ago. Stale evidence.', observation_ref: 'obs-dns-04' },
];

export const phase3Summary: TrafficSummary = {
  interval: { from: ago(60), to: ago(0), live: true },
  generated_at: ago(0),
  accounting: 'live-interval',
  // The same device may rank at several accounting points; each row is one
  // observation at one point and rows are never summed across points.
  rankings: [
    { device_id: 'device-a', label: 'Example workstation', bytes_sent: 845_622, bytes_received: 14_806_528, share_of_attributed: 0.91, evidence: 'observed', accounting_point: 'wan-egress', namespace: 'forwarding', source_id: 'flow-observer', observation_ref: 'obs-flow-02' },
    { device_id: 'device-a', label: 'Example workstation', bytes_sent: 64_000, bytes_received: 128_000, share_of_attributed: 0.04, evidence: 'partial', accounting_point: 'segment-a-internal', namespace: 'forwarding', source_id: 'flow-observer' },
    { device_id: 'device-c', label: 'Unidentified device', bytes_sent: 12_480, bytes_received: 0, share_of_attributed: 0.03, evidence: 'partial', accounting_point: 'wan-egress', observation_ref: 'obs-flow-03' },
    { device_id: 'device-b', label: 'Example sensor', bytes_sent: null, bytes_received: null, share_of_attributed: null, evidence: 'unknown', accounting_point: 'wan-egress' },
  ],
  rankings_truncated: true,
  unattributed: { bytes_sent: 64_000, bytes_received: 512_000, note: 'Traffic without a binding valid at observation time. Never reassigned to a device retroactively.' },
  series: [
    { id: 'attributed-rate', label: 'Attributed devices', unit: 'Mbit/s', points: Array.from({ length: 31 }, (_, i) => ({ time: ago(60 - i * 2), value: i === 20 || i === 21 ? null : Math.round(18 + 60 * Math.exp(-((i - 13) ** 2) / 30) + (i % 4) * 2) })) },
    { id: 'unattributed-rate', label: 'Unattributed bucket', unit: 'Mbit/s', points: Array.from({ length: 31 }, (_, i) => ({ time: ago(60 - i * 2), value: i === 20 || i === 21 ? null : Math.round(2 + (i % 5)) })) },
  ],
  gaps: [{ from: ago(20), to: ago(16), reason: 'Collector restart during image health check' }],
  sampling: { source_rate: 0.25, storage_rate: 1, note: 'Collection samples one in four conversations; retention keeps every collected record.' },
  reconciliation: { interface_bytes: 16_300_000, attributed_bytes: 15_700_000, note: 'The difference is unattributed or unsampled traffic, not an error. Interface totals are shared measurements.' },
  sources: demoSources,
};

export const phase3Observations: Record<string, Observation> = {
  'obs-flow-01': { identity: { ref: 'obs-flow-01', kind: 'flow', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'seq-1184', recorded_at: ago(6) }, record: phase3Flows[0], evidence: 'Attributed verdict at the forwarding observation point. Application connectivity unknown.', links: [
    { rel: 'device', href: '/devices/device-a', label: 'Device device-a' },
    { rel: 'rule', href: '/firewall?rule=rule-042', label: 'Rule rule-042' },
    { rel: 'investigation', href: '/investigations/inv-access-flow-01', label: 'Explain access' },
    { rel: 'events', href: '/events?device_id=device-a', label: 'Correlated events' },
  ], sources: demoSources.slice(1, 2) },
  'obs-flow-02': { identity: { ref: 'obs-flow-02', kind: 'flow', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'seq-1177', recorded_at: ago(14) }, record: phase3Flows[1], evidence: 'Attributed firewall match; no application-level response recorded.', links: [
    { rel: 'device', href: '/devices/device-a', label: 'Device device-a' },
    { rel: 'rule', href: '/firewall?rule=rule-010', label: 'Rule rule-010' },
  ], sources: demoSources.slice(1, 2) },
  'obs-flow-03': { identity: { ref: 'obs-flow-03', kind: 'flow', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'seq-1201', recorded_at: ago(10) }, record: phase3Flows[2], evidence: 'Conversation observed; no attributed verdict or byte counters available.', links: [
    { rel: 'investigation', href: '/investigations/inv-access-flow-03', label: 'Explain access' },
  ], sources: demoSources.slice(1, 2) },
  'obs-dns-01': { identity: { ref: 'obs-dns-01', kind: 'dns', source_id: 'flow-observer', source_kind: 'Resolver metadata', boot_id: BOOT, record_id: 'seq-5520', recorded_at: ago(7) }, record: phase3Dns[0], evidence: phase3Dns[0]!.evidence, links: [{ rel: 'device', href: '/devices/device-a', label: 'Device device-a' }] },
  'obs-event-01': { identity: { ref: 'obs-event-01', kind: 'event', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'evt-0091', recorded_at: ago(5) }, record: { ...demoEvents[0]!, observation_ref: 'obs-event-01' }, evidence: 'Event ordering is correlation, not cause.', links: [
    { rel: 'rule', href: '/firewall?rule=rule-042', label: 'Rule rule-042' },
    { rel: 'investigation', href: '/investigations/inv-access-flow-01', label: 'Explain access' },
  ] },
};

export const phase3Investigations: Record<string, AccessInvestigation> = {
  'inv-access-flow-01': {
    // Actual envelope: identity carries the opaque ref; the legacy top-level
    // ref stays only so older fixtures and assertions keep resolving.
    identity: { ref: 'inv-access-flow-01', kind: 'investigation', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'inv-0094', recorded_at: ago(4) },
    ref: 'inv-access-flow-01',
    subject: { device_id: 'device-a', source: '192.0.2.24', destination: '198.51.100.60', protocol: 'TCP', destination_port: 443, queried_at: ago(4) },
    observed_decision: { verdict: 'blocked', evidence: 'Attributed deny verdict recorded at the forwarding observation point. This does not describe application connectivity.', observed_at: ago(5), observation_ref: 'obs-flow-01' },
    policy_path: [
      { step: 'Baseline connection-state allowance', rule_id: 'rule-010', action: 'allow', scope: 'Router baseline', hook: 'forward', order: 10, installed: true, applicable: false, observed_match: false, counters_scope: 'shared', origin: { producer: 'Image policy compiler', policy_id: 'established-replies', revision: 'example-r8', source_ref: 'image manifest' }, observed_at: ago(34) },
      { step: 'Segment egress restriction', rule_id: 'rule-042', action: 'deny', scope: 'Inherited · Example segment A', hook: 'forward', order: 42, installed: true, applicable: true, observed_match: true, counters_scope: 'shared', origin: { producer: 'Configuration compiler', policy_id: 'segment-egress', revision: 'example-r42', source_ref: 'bundled configuration' }, observed_at: ago(34) },
      { step: 'Time-limited service grant (context)', rule_id: 'rule-108', action: 'allow', scope: 'Device-specific exception', hook: 'forward', order: 108, installed: true, applicable: false, observed_match: false, counters_scope: 'unknown', origin: { producer: 'Local grant receiver', policy_id: 'service-grant', revision: 'example-v3', source_ref: 'local install receipt' }, observed_at: ago(45) },
    ],
    binding: { device_id: 'device-a', address: '192.0.2.24', valid_from: ago(180), valid_until: null, source: 'Local lease', confidence: 'Lease association valid at the observation time' },
    translation: { recorded: false, note: 'No translation recorded for this tuple; none is inferred.' },
    route: { interface: 'Example uplink', next_hop: '203.0.113.1', evidence: 'Route lookup recorded by the forwarding observer; egress was never reached.' },
    unresolved_questions: [
      'Did the application handshake complete? No application-level evidence exists.',
      'Is the recorded destination name current? Resolver metadata age applies.',
      'Would the expired grant have matched before expiry? Expired policy is not re-evaluated.',
    ],
    limits: [
      'Flow collection samples one in four conversations; absence of a record is not absence of traffic.',
      'A shared rule counter is not a per-device count.',
      'The expired grant and this denial are correlated in time only; correlation is not cause.',
    ],
    events: [
      { ...demoEvents[0]!, observation_ref: 'obs-event-01' },
      { ...demoEvents[1]! },
    ],
    sources: demoSources,
  },
  'inv-access-flow-03': {
    identity: { ref: 'inv-access-flow-03', kind: 'investigation', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: BOOT, record_id: 'inv-0097', recorded_at: ago(3) },
    ref: 'inv-access-flow-03',
    subject: { device_id: 'device-a', source: '2001:db8:1::24', destination: '2001:db8:2::60', protocol: 'UDP', destination_port: 443, queried_at: ago(3) },
    observed_decision: null,
    // Exactly one historically retained rule — the recorded policy context
    // is not an evaluated path and nothing further is reconstructed.
    policy_path: [
      { step: 'IPv6 destination set', rule_id: 'rule-211', action: 'unknown', scope: 'Inherited · Example group', hook: 'forward', order: 211, installed: true, applicable: null, observed_match: null, counters_scope: 'unknown', origin: { producer: '', revision: 'example-r42' }, observed_at: ago(34) },
    ],
    binding: { device_id: 'device-a', address: '2001:db8:1::24', valid_from: ago(90), valid_until: null, source: 'Neighbour observation', confidence: 'Observed association; privacy addresses rotate' },
    translation: { recorded: false, note: 'No translation recorded; none is inferred.' },
    route: null,
    unresolved_questions: [
      'Was this conversation allowed? No attributed verdict was recorded.',
      'Which set members did rule-211 match? Set expansion is unsupported.',
      'What carried the traffic? UDP/443 alone does not identify an application.',
    ],
    limits: ['Origin unavailable for rule-211.', 'Unsupported set semantics produce a partial explanation, never a guessed verdict.'],
    sources: demoSources,
  },
};

export const phase3Exposure: Exposure = {
  generated_at: ago(0),
  verified_externally: 'never',
  listeners: [
    { id: 'listener-1', address: '192.0.2.1', port: 443, protocol: 'TCP', configured_label: 'Router console (this interface)', source_restriction: 'Example management segment only', state: 'observed', source_ref: 'image manifest example-r8', observation_ref: 'obs-flow-02', evidence: 'Listener observed open on the configured address.' },
    { id: 'listener-2', address: '192.0.2.1', port: 53, protocol: 'UDP/TCP', configured_label: 'Local DNS resolver', source_restriction: 'Example segments A and B', state: 'observed', source_ref: 'bundled configuration example-r42', evidence: 'Resolver answers on configured segment addresses.' },
    { id: 'listener-3', address: '2001:db8:1::1', port: 53, protocol: 'UDP/TCP', configured_label: 'Local DNS resolver (IPv6)', source_restriction: 'Example segments A and B', state: 'stale', source_ref: 'bundled configuration example-r42', evidence: 'Last confirmed 34 minutes ago; snapshot is stale.' },
  ],
  forwards: [
    { id: 'forward-1', listen: '203.0.113.10:8443/TCP', target: '192.0.2.24:8443', protocol: 'TCP', source_restriction: '198.51.100.0/24 only', state: 'configured', source_ref: 'bundled configuration example-r42', evidence: 'Configured in revision example-r42; inbound attempts unobserved in this window.' },
  ],
  inbound: [
    { rule_id: 'rule-301', name: 'Allow inbound forward', conditions: '198.51.100.0/24 → 192.0.2.24:8443 · TCP', action: 'allow', scope: 'Forwarding rule forward-1', source_restriction: '198.51.100.0/24 only', installed: true, applicable: true, observed_match: null, observed_at: ago(34), origin: { producer: 'Configuration compiler', policy_id: 'inbound-forward', revision: 'example-r42', source_ref: 'bundled configuration' }, evidence: 'Match unobserved; a configured permission is not observed traffic.' },
    { rule_id: 'rule-399', name: 'Inbound default deny', conditions: 'any source → router-local addresses · all protocols', action: 'deny', scope: 'Router baseline · inbound default', source_restriction: 'All other sources', installed: true, applicable: true, observed_match: true, observed_at: ago(34), origin: { producer: 'Image policy compiler', policy_id: 'baseline-inbound', revision: 'example-r8', source_ref: 'image manifest' }, evidence: 'Shared rule counter; denials are not attributed to sources.' },
  ],
  notes: [
    'Configured exposure is shown from the installed policy and image manifests. The console performs no scan, ping or probe; external reachability is never verified.',
    'A listener without a matching inbound permission is still blocked by policy; a permission without a listener does not expose a service.',
    'Dynamic port mappings are unsupported by this image and would appear here with a labelled producer if present.',
  ],
  sources: demoSources,
};

/** Demo transport for the Phase 3 routes. Returns undefined when the route is
 * not handled, so the caller can fall through to existing demo routes. */
export function handlePhase3Demo(route: string, url: URL, role: Role): unknown | undefined {
  const denied = () => { throw { status: 403, code: 'permission_denied', message: 'Detailed traffic, DNS and investigations require Operator or Administrator.' }; };
  if (route === '/traffic/summary') {
    const deviceId = url.searchParams.get('device_id');
    if (!deviceId) return phase3Summary;
    // Device-scoped summary: interface bytes were not measured for one device,
    // so the reconciliation block is omitted — it never becomes zero.
    const scoped: TrafficSummary = { ...phase3Summary, rankings: phase3Summary.rankings?.filter(r => r.device_id === deviceId), rankings_truncated: false };
    delete scoped.reconciliation;
    return scoped;
  }
  if (route === '/dns') {
    if (role === 'viewer') denied();
    // filterDns applies q/device/rcode/resolver/window the same way the
    // server contract does — the same function backs /export?kind=dns.
    return { items: filterDns(phase3Dns, url.searchParams), sources: demoSources.slice(1, 2) };
  }
  if (route === '/export') {
    if (role === 'viewer') denied();
    // Mirrors the backend export contract: only flows and dns are exportable,
    // the shared collection filters (window, device_id, state for flows,
    // rcode/resolver for DNS, q) apply upstream, and the result is bounded
    // to 500 records — the response states that bound explicitly.
    const kind = url.searchParams.get('kind');
    const EXPORT_LIMIT = 500;
    if (kind === 'flows') {
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const deviceId = url.searchParams.get('device_id');
      const items = filterFlows(phase3Flows, url.searchParams)
        .filter(f => (!deviceId || f.device_id === deviceId) && (!q || JSON.stringify(f).toLowerCase().includes(q)))
        .slice(0, EXPORT_LIMIT);
      return { items, bounded: true, limit: EXPORT_LIMIT, exported_at: new Date().toISOString() };
    }
    if (kind === 'dns') {
      const items = filterDns(phase3Dns, url.searchParams).slice(0, EXPORT_LIMIT);
      return { items, bounded: true, limit: EXPORT_LIMIT, exported_at: new Date().toISOString() };
    }
    throw { status: 400, code: 'invalid_export', message: 'Choose flows or dns.' };
  }
  if (route === '/flows') {
    if (role === 'viewer') denied();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const deviceId = url.searchParams.get('device_id');
    // filterFlows applies verdict/protocol/family/translation/window the same
    // way the server contract does; device and text filters narrow further.
    const items = filterFlows(phase3Flows, url.searchParams).filter(f =>
      (!deviceId || f.device_id === deviceId) && (!q || JSON.stringify(f).toLowerCase().includes(q)));
    return { items, sources: demoSources.slice(1, 2) };
  }
  if (route.startsWith('/observations/')) {
    const ref = decodeURIComponent(route.split('/')[2] || '');
    const observation = phase3Observations[ref];
    if (!observation) throw { status: 404, code: 'not_retained', message: 'Observation not retained. It may be outside the retention window or sampled away.' };
    if (role === 'viewer' && ['flow', 'dns'].includes(observation.identity.kind)) denied();
    return observation;
  }
  if (route.startsWith('/investigations/')) {
    if (role === 'viewer') denied();
    const ref = decodeURIComponent(route.split('/')[2] || '');
    const investigation = phase3Investigations[ref];
    if (!investigation) throw { status: 404, code: 'not_found', message: 'Investigation unavailable. Subjects are derived from recorded observations.' };
    return investigation;
  }
  if (route === '/exposure') return phase3Exposure;
  if (route === '/events') {
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const deviceId = url.searchParams.get('device_id');
    const severity = url.searchParams.get('severity');
    const kind = url.searchParams.get('kind');
    const period = interval(url.searchParams);
    const items = phase3Events.filter(e =>
      (!severity || e.severity === severity) && (!kind || e.kind === kind) &&
      (!deviceId || e.device_id === deviceId) && (!q || JSON.stringify(e).toLowerCase().includes(q)) &&
      (!period || !e.time || !Number.isFinite(Date.parse(e.time)) || Date.parse(e.time) >= period.from && Date.parse(e.time) <= period.to));
    return { items };
  }
  return undefined;
}

/** Fictional device list re-export for phase 3 stories and pages. */
export const phase3Devices = demoDevices;
