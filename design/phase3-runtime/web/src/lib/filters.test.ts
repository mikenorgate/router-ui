// Unit coverage for the demo-transport server-filter predicates. These
// functions emulate the router's upstream filtering (the /dns collection and
// /export?kind=dns share filterDns; /flows and /export?kind=flows share
// filterFlows). Production pages render the returned page as-is and never
// apply them client-side.
import { describe, expect, it } from 'vitest';
import type { Flow } from '../types';
import type { DnsObservation } from './contracts';
import { filterDns, filterFlows, interval } from './filters';
import { phase3Dns, phase3Flows } from './phase3Demo';

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();

describe('interval', () => {
  it('parses explicit from/to bounds and named ranges only', () => {
    expect(interval(new URLSearchParams('from=2026-10-14T08:00:00Z&to=2026-10-14T09:00:00Z')))
      .toEqual({ from: Date.parse('2026-10-14T08:00:00Z'), to: Date.parse('2026-10-14T09:00:00Z') });
    const ranged = interval(new URLSearchParams('range=1h'));
    expect(ranged && ranged.to - ranged.from).toBe(3_600_000);
    // Incomplete or unknown bounds produce no window at all.
    expect(interval(new URLSearchParams('from=2026-10-14T08:00:00Z'))).toBeNull();
    expect(interval(new URLSearchParams('range=7d'))).toBeNull();
    expect(interval(new URLSearchParams())).toBeNull();
  });
});

describe('filterFlows', () => {
  it('applies verdict, state, protocol, family and translation predicates', () => {
    expect(filterFlows(phase3Flows, new URLSearchParams('verdict=blocked')).map(f => f.id)).toEqual(['flow-01']);
    expect(filterFlows(phase3Flows, new URLSearchParams('state=decision')).map(f => f.id)).toEqual(['flow-01']);
    expect(filterFlows(phase3Flows, new URLSearchParams('state=completed')).map(f => f.id)).toEqual(['flow-02']);
    expect(filterFlows(phase3Flows, new URLSearchParams('protocol=UDP')).map(f => f.id)).toEqual(['flow-03']);
    expect(filterFlows(phase3Flows, new URLSearchParams('family=6')).map(f => f.id)).toEqual(['flow-03']);
    expect(filterFlows(phase3Flows, new URLSearchParams('translation=recorded')).map(f => f.id)).toEqual(['flow-02']);
    expect(filterFlows(phase3Flows, new URLSearchParams('translation=unrecorded')).map(f => f.id)).toEqual(['flow-01', 'flow-03']);
  });
  it('applies the window against started/last-seen bounds', () => {
    // flow-01 was last seen 5 minutes ago; a window starting 4 minutes ago
    // excludes it while the still-warm records remain.
    const items = filterFlows(phase3Flows, new URLSearchParams(`from=${at(4)}&to=${at(0)}`));
    expect(items.map(f => f.id)).toEqual(['flow-02', 'flow-03']);
  });
  it('keeps time-unknown records visible instead of dropping evidence', () => {
    const timeless = { id: 'flow-timeless', device_id: 'device-a', protocol: 'TCP' } as Flow;
    const items = filterFlows([timeless], new URLSearchParams(`from=${at(60)}&to=${at(0)}`));
    expect(items.map(f => f.id)).toEqual(['flow-timeless']);
  });
});

describe('filterDns', () => {
  it('applies rcode against backend and legacy result names', () => {
    expect(filterDns(phase3Dns, new URLSearchParams('rcode=NXDOMAIN')).map(d => d.id)).toEqual(['dns-03']);
    // dns-04 is the legacy fixture shape (rcode alias, no result field).
    expect(filterDns(phase3Dns, new URLSearchParams('rcode=SERVFAIL')).map(d => d.id)).toEqual(['dns-04']);
  });
  it('applies resolver, device and text predicates', () => {
    expect(filterDns(phase3Dns, new URLSearchParams('resolver=upstream')).map(d => d.id)).toEqual(['dns-04']);
    expect(filterDns(phase3Dns, new URLSearchParams('resolver=router-local')).map(d => d.id)).toEqual(['dns-01', 'dns-02', 'dns-03']);
    expect(filterDns(phase3Dns, new URLSearchParams('device_id=device-a')).map(d => d.id)).toEqual(['dns-01', 'dns-02']);
    expect(filterDns(phase3Dns, new URLSearchParams('q=cdn.example')).map(d => d.id)).toEqual(['dns-02']);
  });
  it('applies the window to the observation time', () => {
    // dns-01 observed 7 min ago, dns-02 9 min, dns-03 12 min, dns-04 90 min.
    const items = filterDns(phase3Dns, new URLSearchParams(`from=${at(10)}&to=${at(5)}`));
    expect(items.map(d => d.id)).toEqual(['dns-01', 'dns-02']);
  });
  it('keeps time-unknown records visible and matches the UNOBSERVED_RESPONSE rcode', () => {
    const unobserved: DnsObservation = { id: 'dns-unobserved', device_id: 'device-b', query: 'missed.example', type: 'A', result: 'UNOBSERVED_RESPONSE', resolver: 'router-local' };
    const items = filterDns([...phase3Dns, unobserved], new URLSearchParams(`rcode=UNOBSERVED_RESPONSE&from=${at(60)}&to=${at(0)}`));
    expect(items.map(d => d.id)).toEqual(['dns-unobserved']);
  });
});
