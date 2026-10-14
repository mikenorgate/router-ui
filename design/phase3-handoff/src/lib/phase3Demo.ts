// Fictional Phase 3 fixtures and demo transport. Wire handlePhase3Demo into
// createDemo in web/src/lib/demo.ts, before the existing '/flows' branch and
// the final 404 fallthrough (integration step 4 in README.md).
// All records are fictional: documentation addresses (RFC 5737 / RFC 3849),
// example names, and a fixture boot identity. No site-specific identifiers.
import type { Role } from '../types';
import { demoDevices, demoEvents, demoFlows, demoSources } from './demo';
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

export const phase3Dns: DnsObservation[] = [
  { id: 'dns-01', device_id: 'device-a', query_name: 'service.example', query_type: 'A', rcode: 'NOERROR', answers: 2, resolver: 'router-local', latency_ms: 12, observed_at: ago(7), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Resolver metadata association, recorded at query time. Name does not identify the application.', observation_ref: 'obs-dns-01' },
  { id: 'dns-02', device_id: 'device-a', query_name: 'cdn.example', query_type: 'AAAA', rcode: 'NOERROR', answers: 1, resolver: 'router-local', latency_ms: 18, observed_at: ago(9), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Shared hosting is expected; the name is not a destination identity.', observation_ref: 'obs-dns-02' },
  { id: 'dns-03', device_id: 'device-c', query_name: 'unresolved.example', query_type: 'A', rcode: 'NXDOMAIN', answers: 0, resolver: 'router-local', latency_ms: 41, observed_at: ago(12), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Negative answer recorded by the resolver; not a policy verdict.', observation_ref: 'obs-dns-03' },
  { id: 'dns-04', device_id: 'device-b', query_name: 'updates.example', query_type: 'A', rcode: 'SERVFAIL', answers: null, resolver: 'upstream', latency_ms: null, observed_at: ago(90), source_id: 'flow-observer', sampling_rate: 1, evidence: 'Upstream resolver failure, last observed 90 minutes ago. Stale evidence.', observation_ref: 'obs-dns-04' },
];

export const phase3Summary: TrafficSummary = {
  interval: { from: ago(60), to: ago(0), live: true },
  generated_at: ago(0),
  accounting: 'live-interval',
  rankings: [
    { device_id: 'device-a', label: 'Example workstation', bytes_sent: 845_622, bytes_received: 14_806_528, share_of_attributed: 0.91, evidence: 'observed', observation_ref: 'obs-flow-02' },
    { device_id: 'device-c', label: 'Unidentified device', bytes_sent: 12_480, bytes_received: 0, share_of_attributed: 0.06, evidence: 'partial', observation_ref: 'obs-flow-03' },
    { device_id: 'device-b', label: 'Example sensor', bytes_sent: null, bytes_received: null, share_of_attributed: null, evidence: 'unknown' },
  ],
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
    ref: 'inv-access-flow-01',
    subject: { device_id: 'device-a', source: '192.0.2.24', destination: '198.51.100.60', protocol: 'TCP', destination_port: 443, queried_at: ago(4) },
    observed_decision: { verdict: 'blocked', evidence: 'Attributed deny verdict recorded at the forwarding observation point. This does not describe application connectivity.', observed_at: ago(5), observation_ref: 'obs-flow-01' },
    predicted_outcome: null,
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
    sources: demoSources,
  },
  'inv-access-flow-03': {
    ref: 'inv-access-flow-03',
    subject: { device_id: 'device-a', source: '2001:db8:1::24', destination: '2001:db8:2::60', protocol: 'UDP', destination_port: 443, queried_at: ago(3) },
    observed_decision: null,
    predicted_outcome: { result: 'Partial prediction only', basis: 'IPv6 destination set expansion is unsupported by this console build.', simulated: true },
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
    { rule_id: 'rule-301', action: 'allow', scope: 'Forwarding rule forward-1', source_restriction: '198.51.100.0/24 only', installed: true, applicable: true, observed_match: null, origin: { producer: 'Configuration compiler', policy_id: 'inbound-forward', revision: 'example-r42', source_ref: 'bundled configuration' }, evidence: 'Match unobserved; a configured permission is not observed traffic.' },
    { rule_id: 'rule-399', action: 'deny', scope: 'Router baseline · inbound default', source_restriction: 'All other sources', installed: true, applicable: true, observed_match: true, origin: { producer: 'Image policy compiler', policy_id: 'baseline-inbound', revision: 'example-r8', source_ref: 'image manifest' }, evidence: 'Shared rule counter; denials are not attributed to sources.' },
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
    return deviceId
      ? { ...phase3Summary, rankings: phase3Summary.rankings?.filter(r => r.device_id === deviceId) }
      : phase3Summary;
  }
  if (route === '/dns') {
    if (role === 'viewer') denied();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const deviceId = url.searchParams.get('device_id');
    const rcode = url.searchParams.get('rcode');
    const items = phase3Dns.filter(d =>
      (!q || JSON.stringify(d).toLowerCase().includes(q)) &&
      (!deviceId || d.device_id === deviceId) &&
      (!rcode || d.rcode === rcode));
    return { items, sources: demoSources.slice(1, 2) };
  }
  if (route === '/flows') {
    if (role === 'viewer') denied();
    const deviceId = url.searchParams.get('device_id');
    const verdict = url.searchParams.get('verdict');
    const items = phase3Flows.filter(f =>
      (!deviceId || f.device_id === deviceId) && (!verdict || (f.verdict || 'unknown') === verdict));
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
  if (route === '/events' && (url.searchParams.get('severity') || url.searchParams.get('kind'))) {
    const severity = url.searchParams.get('severity');
    const kind = url.searchParams.get('kind');
    return { items: demoEvents.filter(e => (!severity || e.severity === severity) && (!kind || e.kind === kind)) };
  }
  return undefined;
}

/** Fictional device list re-export for phase 3 stories and pages. */
export const phase3Devices = demoDevices;
