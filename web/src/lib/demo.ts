import type { Address, ConsoleEvent, Device, Flow, Overview, Policy, Role, Session, Source, SystemInfo } from '../types';

const ago = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();
export const demoSources: Source[] = [
  { id: 'interface-counters', kind: 'Interface counters', status: 'current', observed_at: ago(0.5), lag_seconds: 30, coverage: 'Router interfaces; shared totals, not device counters', sampling_rate: 1, lost_records: 0, last_sequence: 482 },
  { id: 'flow-observer', kind: 'Flow metadata', status: 'sampled', observed_at: ago(1), lag_seconds: 60, coverage: 'Routed conversations only; intra-segment traffic unobserved', sampling_rate: 0.25, lost_records: 8, last_sequence: 1208 },
  { id: 'policy-snapshot', kind: 'Installed policy', status: 'stale', observed_at: ago(34), lag_seconds: 2040, coverage: 'Last observed installed revision; current removal not established', sampling_rate: 1 },
  { id: 'radio-observer', kind: 'Wireless metrics', status: 'unsupported', coverage: 'No local wireless observation source' },
];
const binding: Address = { address: '192.0.2.24', family: 'IPv4', valid_from: ago(180), source: 'Local lease', confidence: 'Lease association' };
export const demoDevices: Device[] = [
  { id: 'device-a', name: 'Example workstation', segment: 'Example segment A', mac: '02:00:00:00:00:24', addresses: [binding, { address: '2001:db8:1::24', family: 'IPv6', valid_from: ago(90), source: 'Neighbour observation', confidence: 'Observed association' }], last_seen: ago(1), observed_at: ago(1), status: 'recently observed', sources: demoSources.slice(0, 2) },
  { id: 'device-b', name: 'Example sensor', segment: 'Example segment B', mac: '02:00:00:00:00:32', addresses: [{ ...binding, address: '198.51.100.32' }], last_seen: ago(90), observed_at: ago(90), status: 'stale', sources: [] },
  { id: 'device-c', name: 'Unidentified device', segment: 'Example segment A', addresses: [{ address: '192.0.2.80', family: 'IPv4', source: 'Neighbour observation', confidence: 'Partial; identity unconfirmed' }], status: 'unknown' },
];
export const demoFlows: Flow[] = [
  { id: 'flow-01', device_id: 'device-a', source_ip: '192.0.2.24', destination_ip: '198.51.100.60', destination_name: 'service.example', source_port: 52144, destination_port: 443, protocol: 'TCP', bytes_sent: 1248, bytes_received: 0, started_at: ago(6), last_seen: ago(5), verdict: 'blocked', rule_id: 'rule-042', sampling_rate: 0.25, evidence: 'Attributed verdict at the forwarding observation point. Application connectivity unknown.', source_id: 'flow-observer' },
  { id: 'flow-02', device_id: 'device-a', source_ip: '192.0.2.24', destination_ip: '203.0.113.40', source_port: 50111, destination_port: 443, protocol: 'TCP', bytes_sent: 845622, bytes_received: 14806528, translated_source_ip: '203.0.113.10', started_at: ago(14), last_seen: ago(1), verdict: 'allowed', rule_id: 'rule-010', sampling_rate: 0.25, evidence: 'Attributed firewall match; no application-level response recorded.', source_id: 'flow-observer' },
  { id: 'flow-03', device_id: 'device-a', source_ip: '2001:db8:1::24', destination_ip: '2001:db8:2::60', source_port: 53510, destination_port: 443, protocol: 'UDP', started_at: ago(10), last_seen: ago(2), verdict: 'unknown', sampling_rate: 0.25, evidence: 'Conversation observed; no attributed verdict or byte counters available.', source_id: 'flow-observer' },
];
export const demoPolicies: Policy[] = [
  { id: 'rule-010', name: 'Permit established replies', action: 'allow', scope: 'Router baseline · connection-state dependent', conditions: 'IPv4 / IPv6 · established, related', installed: true, applicable: true, observed_match: true, origin: { producer: 'Image policy compiler', policy_id: 'established-replies', revision: 'example-r8', source_ref: 'image manifest', group_id: 'baseline' }, table: 'filter', chain: 'forward', hook: 'forward', priority: 0, order: 10, observed_at: ago(34), counters_scope: 'shared', packets: 1284, bytes: 520442 },
  { id: 'rule-042', name: 'Restrict inter-segment traffic', action: 'deny', scope: 'Inherited · Example segment A', conditions: '192.0.2.0/24 → 198.51.100.0/24 · TCP/443', installed: true, applicable: true, observed_match: true, device_id: 'device-a', origin: { producer: 'Configuration compiler', policy_id: 'segment-egress', revision: 'example-r42', source_ref: 'bundled configuration', group_id: 'example-segment-a' }, table: 'filter', chain: 'segment-policy', hook: 'forward', priority: 0, order: 42, observed_at: ago(34), counters_scope: 'shared', packets: 24, bytes: 29952 },
  { id: 'rule-108', name: 'Time-limited service grant', action: 'allow', scope: 'Device-specific exception', conditions: '192.0.2.24 → 198.51.100.60 · TCP/8443', installed: true, applicable: false, observed_match: false, device_id: 'device-a', origin: { producer: 'Local grant receiver', policy_id: 'service-grant', revision: 'example-v3', source_ref: 'local install receipt' }, table: 'filter', chain: 'service-grants', hook: 'forward', order: 108, observed_at: ago(45), expires_at: ago(12), counters_scope: 'unknown' },
  { id: 'rule-211', name: 'IPv6 destination set', action: 'unknown', scope: 'Inherited · Example group', conditions: 'IPv6 · set expansion unsupported', installed: true, origin: { producer: '', revision: 'example-r42' }, table: 'filter', chain: 'forward', hook: 'forward', order: 211, observed_at: ago(34), counters_scope: 'unknown' },
];
export const demoEvents: ConsoleEvent[] = [
  { id: 'event-1', time: ago(5), kind: 'firewall', severity: 'warning', title: 'Attributed connection denial', detail: 'Forwarding observation references rule-042. This does not establish application connectivity.', device_id: 'device-a', rule_id: 'rule-042', source_id: 'flow-observer' },
  { id: 'event-2', time: ago(12), kind: 'policy', severity: 'warning', title: 'Recorded grant expiry passed', detail: 'Expiry is recorded; removal awaits a later installed snapshot.', device_id: 'device-a', rule_id: 'rule-108', source_id: 'policy-snapshot' },
  { id: 'event-3', time: ago(20), kind: 'collection', severity: 'warning', title: 'Collection gap', detail: 'Eight flow records lost. Missing measurements are not zero traffic.', source_id: 'flow-observer' },
  { id: 'event-4', time: ago(90), kind: 'address', severity: 'info', title: 'IPv6 address association observed', detail: 'Neighbour evidence associated this address at the recorded time; identity confidence remains qualified.', device_id: 'device-a' },
];
export const demoOverview: Overview = {
  metrics: [
    { id: 'download', label: 'Interface receive rate', value: 58.2, unit: 'Mbit/s', observed_at: ago(0.5), status: 'current', scope: 'Router interface · shared' },
    { id: 'upload', label: 'Interface transmit rate', value: 16, unit: 'Mbit/s', observed_at: ago(0.5), status: 'current', scope: 'Router interface · shared' },
    { id: 'latency', label: 'Gateway probe latency', value: 24, unit: 'ms', observed_at: ago(7), status: 'stale', scope: 'Router-originated probe · last success' },
    { id: 'loss', label: 'Packet loss', value: null, unit: '%', status: 'unsupported', scope: 'No qualified loss source' },
  ],
  series: ['Receive', 'Transmit'].map((label, lane) => ({ id: label.toLowerCase(), label, unit: 'Mbit/s', points: Array.from({ length: 31 }, (_, i) => ({ time: ago(60 - i * 2), value: i === 20 || i === 21 ? null : Math.round((lane ? 8 : 30) + (lane ? 12 : 90) * Math.exp(-((i - 13) ** 2) / 30) + (i % 4) * 2) })) })),
  devices_total: 3, active_devices: 1, flows_total: 3, events: demoEvents, sources: demoSources,
};
export const demoSystem: SystemInfo = { version: 'example-build', mode: 'fixture', sources: demoSources, capabilities: [{ id: 'interface-counters', supported: true, reason: 'Local router counters' }, { id: 'attributed-verdicts', supported: true, reason: 'Partial sampled forwarding observations' }, { id: 'wireless-topology', supported: false, reason: 'Router has no physical switch or wireless source' }], storage: { used_bytes: 128 * 1024 ** 2, budget_bytes: 512 * 1024 ** 2, raw_days: 7, history_days: 30, sampling_rate: 0.25 }, listeners: [{ address: '192.0.2.1:443', status: 'configured' }], auth: { oidc_enabled: true, local_recovery: true }, certificates: [{ names: ['router.example'], expires_at: new Date(Date.now() + 30 * 86400_000).toISOString(), status: 'current' }] };

export function createDemo(role: Role = 'operator') {
  let session: Session | null = { user: { id: 'example-user', name: 'Example operator', role }, csrf_token: 'explicit-demo-csrf', mode: 'fixture' };
  const annotations = new Map<string, { alias: string; note: string }>();
  return async (path: string, init: RequestInit = {}): Promise<unknown> => {
    if (init.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url = new URL(path, 'http://router.example');
    const route = url.pathname;
    const methods = { local: true, oidc: { enabled: false, name: 'Configured identity provider', login_url: '/auth/oidc/login' } };
    if (route === '/auth/methods') return methods;
    if (route === '/auth/login') {
      session = { user: { id: 'example-user', name: 'Example operator', role }, csrf_token: 'explicit-demo-csrf', mode: 'fixture' };
      return session;
    }
    if (!session) throw { status: 401, code: 'session_expired', message: 'Sign in to continue.' };
    if (route === '/session') return session;
    if (init.method === 'POST' && new Headers(init.headers).get('X-CSRF-Token') !== session.csrf_token) throw { status: 403, code: 'csrf', message: 'CSRF token missing.' };
    if (route === '/auth/logout') { session = null; return {}; }
    const q = (url.searchParams.get('q') || '').toLowerCase();
    const deviceId = url.searchParams.get('device_id');
    const matches = (item: unknown) => JSON.stringify(item).toLowerCase().includes(q);
    const collection = <T,>(items: T[]) => ({ items: items.filter(matches) });
    if (route === '/overview') {
      const minutes = url.searchParams.get('range') === '15m' ? 15 : 24 * 60;
      return { ...demoOverview, series: demoOverview.series?.map(lane => ({ ...lane, points: lane.points?.filter(p => Date.parse(p.time) >= Date.now() - minutes * 60_000) })) };
    }
    if (route === '/devices') return collection(demoDevices.map(d => ({ ...d, name: annotations.get(d.id)?.alias || d.name })));
    if (route.startsWith('/devices/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      const device = demoDevices.find(d => d.id === id);
      if (!device) throw { status: 404, code: 'not_found', message: 'Device not found.' };
      if (route.endsWith('/annotation')) {
        if (session.user.role === 'viewer') throw { status: 403, code: 'permission_denied', message: 'Operator or Administrator role required.' };
        const annotation = JSON.parse(String(init.body)) as { alias: string; note: string };
        annotations.set(id, annotation); return annotation;
      }
      return { device: { ...device, name: annotations.get(id)?.alias || device.name }, bindings: [...(device.addresses || []), { ...binding, address: '192.0.2.19', valid_from: ago(300), valid_until: ago(180) }], annotation: annotations.get(id) || { alias: '', note: '' }, flows: session.user.role === 'viewer' ? [] : demoFlows.filter(f => f.device_id === id), detail_restricted: session.user.role === 'viewer', policies: demoPolicies.filter(p => !p.device_id || p.device_id === id), events: demoEvents.filter(e => e.device_id === id) };
    }
    if (route === '/flows' || route === '/export') {
      if (session.user.role === 'viewer') throw { status: 403, code: 'permission_denied', message: 'Detailed traffic and export require Operator or Administrator.' };
      return collection(demoFlows.filter(f => !deviceId || f.device_id === deviceId));
    }
    if (route === '/policies') return collection(demoPolicies.filter(p => !deviceId || !p.device_id || p.device_id === deviceId));
    if (route === '/events') return collection(demoEvents.filter(e => !deviceId || e.device_id === deviceId));
    if (route === '/system') return demoSystem;
    if (route === '/network') return { interfaces: [{ name: 'Example uplink', state: 'up', addresses: ['203.0.113.10'], rx_bytes: 14806528, tx_bytes: 845622 }, { name: 'Example internal', state: 'up', addresses: ['192.0.2.1', '2001:db8:1::1'] }], segments: [{ id: 'segment-a', name: 'Example segment A', cidr: '192.0.2.0/24' }, { id: 'segment-b', name: 'Example segment B', cidr: '198.51.100.0/24' }], routes: [{ destination: '0.0.0.0/0', gateway: '203.0.113.1', interface: 'Example uplink', family: 'IPv4' }, { destination: '2001:db8:1::/64', interface: 'Example internal', family: 'IPv6' }], coverage_notes: ['Only router-local logical interfaces, segments and routes are observed.', 'Physical switch ports and intra-segment conversations are unobserved.'] };
    throw { status: 404, code: 'not_found', message: 'Demo endpoint unavailable.' };
  };
}
