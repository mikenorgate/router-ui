// Phase 3 contract tests: typed path builders plus the fixture transport's
// server-side filters, direct observation references, and role checks. These
// run against createDemo exactly as the UI consumes it.
import { describe, expect, it } from 'vitest';
import { createDemo } from '../lib/demo';
import type { AccessInvestigation, DnsObservation, Exposure, FlowWithRef, Observation, TrafficSummary } from '../lib/contracts';
import type { Collection, ConsoleEvent } from '../types';
import { dnsPath, eventsPath, exposurePath, flowsPath, investigationPath, observationPath, trafficSummaryPath } from '../lib/phase3Api';

describe('phase 3 path builders', () => {
  it('encodes window and server filters through the shared query helper', () => {
    expect(trafficSummaryPath({ range: '1h', device_id: 'device a' })).toBe('/traffic/summary?range=1h&device_id=device+a');
    expect(flowsPath({ verdict: 'blocked', family: '6', limit: '50', cursor: 'c1' })).toBe('/flows?verdict=blocked&family=6&limit=50&cursor=c1');
    expect(flowsPath({ state: 'active', device_id: 'device-a' })).toBe('/flows?device_id=device-a&state=active');
    expect(dnsPath({ q: 'cdn.example', rcode: 'NXDOMAIN' })).toBe('/dns?q=cdn.example&rcode=NXDOMAIN');
    expect(eventsPath({ severity: 'warning', kind: 'firewall', from: '2026-10-14T08:00:00Z', to: '2026-10-14T09:00:00Z' }))
      .toBe('/events?severity=warning&kind=firewall&from=2026-10-14T08%3A00%3A00Z&to=2026-10-14T09%3A00%3A00Z');
    expect(observationPath('obs flow/01')).toBe('/observations/obs%20flow%2F01');
    expect(investigationPath('inv-access-flow-01')).toBe('/investigations/inv-access-flow-01');
    expect(exposurePath()).toBe('/exposure');
  });
});

describe('phase 3 fixture transport — role checks', () => {
  it('denies Viewer flow, DNS, observation and investigation detail with 403', async () => {
    const demo = createDemo('viewer');
    for (const path of ['/dns', '/flows', '/observations/obs-flow-01', '/observations/obs-dns-01', '/investigations/inv-access-flow-01'])
      await expect(demo(path)).rejects.toMatchObject({ status: 403, code: 'permission_denied' });
  });
  it('keeps Viewer summary surfaces: traffic summary, exposure and events', async () => {
    const demo = createDemo('viewer');
    const summary = await demo('/traffic/summary') as TrafficSummary;
    expect(summary.accounting).toBe('live-interval');
    const exposure = await demo('/exposure') as Exposure;
    expect(exposure.verified_externally).toBe('never');
    const events = await demo('/events?severity=warning') as Collection<ConsoleEvent>;
    expect(events.items?.length).toBeGreaterThan(0);
  });
  it('allows Operator detail surfaces', async () => {
    const demo = createDemo('operator');
    expect((await demo('/dns') as Collection<DnsObservation>).items?.length).toBe(4);
    expect(((await demo('/flows') as Collection<FlowWithRef>).items || []).every(f => f.observation_ref)).toBe(true);
    expect((await demo('/investigations/inv-access-flow-01') as AccessInvestigation).ref).toBe('inv-access-flow-01');
  });
});

describe('phase 3 fixture transport — direct references', () => {
  it('resolves an observation by opaque reference independent of list paging and filters', async () => {
    const demo = createDemo();
    // The list page filtered to blocked verdicts does not contain flow-02…
    const page = await demo('/flows?verdict=blocked') as Collection<FlowWithRef>;
    expect(page.items?.map(f => f.id)).toEqual(['flow-01']);
    // …but its reference still resolves, carrying full identity.
    const observation = await demo('/observations/obs-flow-02') as Observation;
    expect(observation.identity).toMatchObject({ ref: 'obs-flow-02', kind: 'flow', source_id: 'flow-observer', boot_id: 'boot-example-7f2c', record_id: 'seq-1177' });
    expect((observation.record as FlowWithRef).destination_ip).toBe('203.0.113.40');
  });
  it('reports unknown references as not retained rather than inventing a record', async () => {
    const demo = createDemo();
    await expect(demo('/observations/obs-gone')).rejects.toMatchObject({ status: 404, code: 'not_retained' });
    await expect(demo('/investigations/inv-gone')).rejects.toMatchObject({ status: 404 });
  });
  it('links the denial event to its underlying observation', async () => {
    const demo = createDemo();
    const observation = await demo('/observations/obs-event-01') as Observation;
    expect(observation.identity.kind).toBe('event');
    expect(observation.links?.some(link => link.rel === 'investigation')).toBe(true);
  });
});

describe('phase 3 fixture transport — server filters and accounting', () => {
  it('applies verdict and text filters to flows before pagination', async () => {
    const demo = createDemo();
    expect(((await demo('/flows?verdict=unknown') as Collection<FlowWithRef>).items || []).map(f => f.id)).toEqual(['flow-03']);
    expect(((await demo('/flows?q=service.example') as Collection<FlowWithRef>).items || []).map(f => f.id)).toEqual(['flow-01']);
  });
  it('applies the record-state server filter to flows', async () => {
    const demo = createDemo();
    expect(((await demo('/flows?state=decision') as Collection<FlowWithRef>).items || []).map(f => f.id)).toEqual(['flow-01']);
    expect(((await demo('/flows?state=completed') as Collection<FlowWithRef>).items || []).map(f => f.id)).toEqual(['flow-02']);
    expect(((await demo('/flows?state=active') as Collection<FlowWithRef>).items || []).map(f => f.id)).toEqual(['flow-03']);
    const completed = (await demo('/flows?state=completed') as Collection<FlowWithRef>).items?.[0];
    expect(completed).toMatchObject({
      namespace: 'forwarding', zone: 'example-segment-a', observation_point: 'egress-interface',
      translated_source_port: 51024, translated_destination_port: 443,
      policy_revision: 'example-r8', binding_ref: 'binding-192-0-2-24',
    });
  });
  it('applies severity/kind server filters to events and keeps observation references', async () => {
    const demo = createDemo();
    const warnings = await demo('/events?severity=warning') as Collection<ConsoleEvent & { observation_ref?: string }>;
    expect(warnings.items?.every(e => e.severity === 'warning')).toBe(true);
    expect(warnings.items?.some(e => e.severity === 'info')).toBe(false);
    const denial = warnings.items?.find(e => e.id === 'event-1');
    expect(denial?.observation_ref).toBe('obs-event-01');
    const firewall = await demo('/events?kind=firewall') as Collection<ConsoleEvent>;
    expect(firewall.items?.map(e => e.id)).toEqual(['event-1']);
  });
  it('applies rcode filters to DNS observations', async () => {
    const demo = createDemo();
    expect(((await demo('/dns?rcode=NXDOMAIN') as Collection<DnsObservation>).items || []).map(d => d.id)).toEqual(['dns-03']);
  });
  it('carries real DNS answer values, TTL records, client and binding — with fixture compatibility', async () => {
    const demo = createDemo();
    const items = (await demo('/dns') as Collection<DnsObservation>).items || [];
    const first = items.find(d => d.id === 'dns-01');
    // Backend shape: query/type/result, answers as values, TTL records.
    expect(first).toMatchObject({ query: 'service.example', type: 'A', result: 'NOERROR', client_ip: '192.0.2.24' });
    expect(first?.answers).toEqual(['198.51.100.60', '198.51.100.61']);
    expect(first?.answer_records?.[0]).toMatchObject({ name: 'service.example', type: 'A', value: '198.51.100.60', ttl: 300 });
    expect(first?.binding).toMatchObject({ device_id: 'device-a', address: '192.0.2.24', source: 'Local lease' });
    // A recorded NXDOMAIN keeps its recorded empty answer set.
    expect(items.find(d => d.id === 'dns-03')?.answers).toEqual([]);
    // Legacy fixture shape remains accepted, with unmeasured latency staying null.
    const legacy = items.find(d => d.id === 'dns-04');
    expect(legacy).toMatchObject({ query_name: 'updates.example', rcode: 'SERVFAIL', answers: null, latency_ms: null });
  });
  it('keeps interval accounting, sampling kinds, gaps and the unattributed bucket explicit', async () => {
    const demo = createDemo();
    const summary = await demo('/traffic/summary') as TrafficSummary;
    expect(summary.accounting).toBe('live-interval');
    expect(summary.interval.live).toBe(true);
    expect(summary.gaps?.length).toBe(1);
    expect(summary.sampling?.source_rate).toBe(0.25);
    expect(summary.sampling?.storage_rate).toBe(1);
    expect(summary.unattributed?.bytes_received).toBe(512_000);
    expect(summary.reconciliation?.interface_bytes).toBeGreaterThan(summary.reconciliation?.attributed_bytes || 0);
    expect(summary.rankings_truncated).toBe(true);
  });
  it('keeps accounting points distinct per device and omits unmeasured reconciliation', async () => {
    const demo = createDemo();
    // The same device ranks at two accounting points; rows stay separate.
    const summary = await demo('/traffic/summary') as TrafficSummary;
    const deviceA = summary.rankings?.filter(r => r.device_id === 'device-a') || [];
    expect(deviceA.map(r => r.accounting_point)).toEqual(['wan-egress', 'segment-a-internal']);
    // Scoped summary: both points survive the device filter…
    const scoped = await demo('/traffic/summary?device_id=device-a') as TrafficSummary;
    expect(scoped.rankings?.map(r => `${r.device_id}@${r.accounting_point}`)).toEqual(['device-a@wan-egress', 'device-a@segment-a-internal']);
    // …and interface bytes were not measured for one device, so the
    // reconciliation block is omitted entirely rather than zeroed.
    expect('reconciliation' in scoped).toBe(false);
    expect(scoped.rankings_truncated).toBe(false);
    // Null bytes stay unknown; the fixture never substitutes zero.
    const sensor = (await demo('/traffic/summary?device_id=device-b') as TrafficSummary).rankings?.[0];
    expect(sensor).toMatchObject({ device_id: 'device-b', bytes_sent: null, bytes_received: null, share_of_attributed: null, evidence: 'unknown' });
  });
  it('describes configured exposure without ever claiming verified reachability', async () => {
    const demo = createDemo();
    const exposure = await demo('/exposure') as Exposure;
    expect(exposure.verified_externally).toBe('never');
    expect(exposure.listeners?.length).toBe(3);
    expect(exposure.inbound?.some(rule => rule.observed_match === true)).toBe(true);
    expect(JSON.stringify(exposure)).not.toMatch(/verified externally":\s*"(yes|partial)/i);
  });
});

describe('phase 3 fixture transport — no simulation', () => {
  it('carries no simulated outcomes anywhere in the investigation payloads', async () => {
    const demo = createDemo();
    for (const ref of ['inv-access-flow-01', 'inv-access-flow-03']) {
      const investigation = await demo(`/investigations/${ref}`) as AccessInvestigation;
      expect(investigation.observed_decision === null || typeof investigation.observed_decision === 'object').toBe(true);
      expect('predicted_outcome' in investigation).toBe(false);
      expect(JSON.stringify(investigation)).not.toMatch(/simulat/i);
    }
    const unobserved = await demo('/investigations/inv-access-flow-03') as AccessInvestigation;
    expect(unobserved.observed_decision).toBeNull();
    expect(unobserved.unresolved_questions?.length).toBeGreaterThan(0);
  });
  it('carries related events with their observation references on investigations', async () => {
    const demo = createDemo();
    const investigation = await demo('/investigations/inv-access-flow-01') as AccessInvestigation;
    expect(investigation.events?.length).toBe(2);
    expect(investigation.events?.[0]).toMatchObject({ id: 'event-1', observation_ref: 'obs-event-01' });
    // The single-retained-rule explanation carries no events array at all.
    const sparse = await demo('/investigations/inv-access-flow-03') as AccessInvestigation;
    expect(sparse.events).toBeUndefined();
    expect(sparse.policy_path?.length).toBe(1);
  });
  it('preserves inbound policy names, conditions and observation times on exposure', async () => {
    const demo = createDemo();
    const exposure = await demo('/exposure') as Exposure;
    const inbound = exposure.inbound || [];
    expect(inbound[0]).toMatchObject({ rule_id: 'rule-301', name: 'Allow inbound forward', conditions: '198.51.100.0/24 → 192.0.2.24:8443 · TCP' });
    expect(typeof inbound[0]?.observed_at).toBe('string');
    expect(inbound[1]?.origin).toMatchObject({ producer: 'Image policy compiler', revision: 'example-r8' });
  });
});
