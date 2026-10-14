import type { Policy, Role, Session, Source } from '../types';
import { producerUnknown } from './policyOrigin';
import { handlePhase3Demo } from './phase3Demo';
import { ago, binding, demoDevices, demoEvents, demoFlows, demoHistoricalDevices, demoOverview, demoPolicies, demoSources, demoSystem } from './demoData';

export { demoSources, demoDevices, demoFlows, demoPolicies, demoEvents, demoOverview, demoSystem } from './demoData';

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
    // Sources able to supply policy evidence, mirroring the backend's policySources selection.
    const policySources = demoSources.filter(s => s.scope === 'policies' || /policy|rule|application/i.test(s.kind || ''));
    if (route === '/overview') {
      const minutes = url.searchParams.get('range') === '15m' ? 15 : 24 * 60;
      return { ...demoOverview, series: demoOverview.series?.map(lane => ({ ...lane, points: lane.points?.filter(p => Date.parse(p.time) >= Date.now() - minutes * 60_000) })) };
    }
    if (route === '/devices') return collection(demoDevices.map(d => ({ ...d, name: annotations.get(d.id)?.alias || d.name })));
    if (route.startsWith('/devices/')) {
      const id = decodeURIComponent(route.split('/')[2] || '');
      // Current inventory first; otherwise fall back to retained history, the
      // same way the backend serves a removed device. current_inventory says
      // which claim this payload makes — the UI must not present retained
      // history as current presence.
      const current = demoDevices.find(d => d.id === id);
      const retained = current ? undefined : demoHistoricalDevices.find(d => d.id === id);
      const device = current ?? retained;
      if (!device) throw { status: 404, code: 'not_found', message: 'Device not found.' };
      if (route.endsWith('/annotation')) {
        // Annotations are console-owned metadata; they stay available for
        // retained historical devices and never rename router records.
        if (session.user.role === 'viewer') throw { status: 403, code: 'permission_denied', message: 'Operator or Administrator role required.' };
        const annotation = JSON.parse(String(init.body)) as { alias: string; note: string };
        annotations.set(id, annotation); return annotation;
      }
      const policies = demoPolicies.filter(p => !p.device_id || p.device_id === id);
      const detail: Record<string, unknown> = { device: { ...device, name: annotations.get(id)?.alias || device.name }, current_inventory: !retained, bindings: [...(device.addresses || []), { ...binding, address: '192.0.2.19', valid_from: ago(300), valid_until: ago(180) }], annotation: annotations.get(id) || { alias: '', note: '' }, flows: session.user.role === 'viewer' ? [] : demoFlows.filter(f => f.device_id === id), detail_restricted: session.user.role === 'viewer', policies, policy_sources: policySources, events: demoEvents.filter(e => e.device_id === id) };
      if (policies.length === 100) detail.policies_next_cursor = '100';
      return detail;
    }
    // Phase 3 investigation routes resolve first: direct observation
    // references, DNS, traffic summary, exposure, investigations, bounded
    // /export (flows|dns), and the server-filtered flows/events collections
    // (with their role checks).
    const phase3 = handlePhase3Demo(route, url, session.user.role);
    if (phase3 !== undefined) return phase3;
    if (route === '/policies') {
      const evidence = url.searchParams.get('evidence') || '';
      if (evidence && !['installed', 'applicable', 'observed', 'unknown'].includes(evidence)) throw { status: 400, code: 'invalid_query', message: 'Unsupported policy evidence' };
      const limitRaw = url.searchParams.get('limit');
      const limit = limitRaw === null ? 100 : Number(limitRaw);
      if (!Number.isInteger(limit) || limit < 1 || limit > 500) throw { status: 400, code: 'invalid_query', message: 'limit must be 1–500' };
      const cursorRaw = url.searchParams.get('cursor');
      const offset = cursorRaw === null ? 0 : Number(cursorRaw);
      if (!Number.isInteger(offset) || offset < 0 || offset > 10000) throw { status: 400, code: 'invalid_query', message: 'invalid cursor' };
      let items = demoPolicies.filter(p => !deviceId || !p.device_id || p.device_id === deviceId).filter(matches);
      if (evidence === 'installed') items = items.filter(p => p.installed === true);
      if (evidence === 'applicable') items = items.filter(p => p.applicable === true);
      if (evidence === 'observed') items = items.filter(p => p.observed_match === true);
      if (evidence === 'unknown') items = items.filter(p => producerUnknown(p.origin?.producer));
      const page = items.slice(offset, offset + limit);
      const body: { items: Policy[]; next_cursor?: string; sources: Source[] } = { items: page, sources: policySources };
      if (page.length === limit && offset + limit <= 10000) body.next_cursor = String(offset + limit);
      return body;
    }
    if (route === '/events') return collection(demoEvents.filter(e => !deviceId || e.device_id === deviceId));
    if (route === '/system') return demoSystem;
    if (route === '/network') return { interfaces: [{ name: 'Example uplink', state: 'up', addresses: ['203.0.113.10'], rx_bytes: 14806528, tx_bytes: 845622 }, { name: 'Example internal', state: 'up', addresses: ['192.0.2.1', '2001:db8:1::1'] }], segments: [{ id: 'segment-a', name: 'Example segment A', cidr: '192.0.2.0/24' }, { id: 'segment-b', name: 'Example segment B', cidr: '198.51.100.0/24' }], routes: [{ destination: '0.0.0.0/0', gateway: '203.0.113.1', interface: 'Example uplink', family: 'IPv4' }, { destination: '2001:db8:1::/64', interface: 'Example internal', family: 'IPv6' }], coverage_notes: ['Only router-local logical interfaces, segments and routes are observed.', 'Physical switch ports and intra-segment conversations are unobserved.'] };
    throw { status: 404, code: 'not_found', message: 'Demo endpoint unavailable.' };
  };
}
