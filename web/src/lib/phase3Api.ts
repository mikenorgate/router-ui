// Typed path builders for the proposed Phase 3 endpoints. These wrap the
// existing query() helper so parameter encoding stays identical to the rest of
// the console, and they plug into the existing request() transport unchanged.
//
// All list endpoints stay bounded (limit/cursor). All filters listed here are
// applied by the server before pagination; the UI never filters the returned
// page and calls it a result set.
import { query } from './api';
import type { WindowParams } from './contracts';

export function trafficSummaryPath(params: WindowParams & { segment?: string | null; family?: string | null; device_id?: string | null }): string {
  return query('/traffic/summary', {
    range: params.range, from: params.from, to: params.to,
    segment: params.segment, family: params.family, device_id: params.device_id,
  });
}

/** Resolve one observation by opaque reference, independent of list paging. */
export function observationPath(ref: string): string {
  return `/observations/${encodeURIComponent(ref)}`;
}

/** Passive access explanation for one investigated subject. */
export function investigationPath(ref: string): string {
  return `/investigations/${encodeURIComponent(ref)}`;
}

export function exposurePath(): string {
  return '/exposure';
}

export function flowsPath(params: WindowParams & {
  q?: string | null; device_id?: string | null; verdict?: string | null;
  protocol?: string | null; family?: string | null; translation?: string | null;
  state?: string | null; limit?: string | null; cursor?: string | null;
}): string {
  return query('/flows', {
    q: params.q, device_id: params.device_id, verdict: params.verdict,
    protocol: params.protocol, family: params.family, translation: params.translation,
    state: params.state,
    range: params.range, from: params.from, to: params.to,
    limit: params.limit, cursor: params.cursor,
  });
}

/** DNS observations. Operator-only on the server; Viewer receives 403. The
 * `rcode` query parameter is the contract's filter name for the result code. */
export function dnsPath(params: WindowParams & {
  q?: string | null; device_id?: string | null; rcode?: string | null;
  resolver?: string | null; limit?: string | null; cursor?: string | null;
}): string {
  return query('/dns', {
    q: params.q, device_id: params.device_id, rcode: params.rcode, resolver: params.resolver,
    range: params.range, from: params.from, to: params.to,
    limit: params.limit, cursor: params.cursor,
  });
}

/** Events with severity and kind applied as server filters. */
export function eventsPath(params: WindowParams & {
  q?: string | null; device_id?: string | null; severity?: string | null;
  kind?: string | null; cursor?: string | null;
}): string {
  return query('/events', {
    q: params.q, device_id: params.device_id, severity: params.severity, kind: params.kind,
    range: params.range, from: params.from, to: params.to, cursor: params.cursor,
  });
}
