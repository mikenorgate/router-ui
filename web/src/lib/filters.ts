import type { ConsoleEvent, Flow } from '../types';
export function interval(params: URLSearchParams): { from: number; to: number } | null {
  const from = params.get('from'), to = params.get('to');
  if (from && to && Number.isFinite(Date.parse(from)) && Number.isFinite(Date.parse(to))) return { from: Date.parse(from), to: Date.parse(to) };
  if (params.has('range')) { const ms = { '15m': 900_000, '1h': 3600_000, '24h': 86400_000 }[params.get('range') as '1h']; if (ms) return { from: Date.now() - ms, to: Date.now() }; }
  return null;
}
export function filterFlows(flows: Flow[], params: URLSearchParams): Flow[] {
  const period = interval(params);
  return flows.filter(flow => {
    const verdict = params.get('verdict'), protocol = params.get('protocol'), family = params.get('family'), translation = params.get('translation');
    if (verdict && (flow.verdict || 'unknown') !== verdict) return false;
    if (protocol && flow.protocol?.toUpperCase() !== protocol) return false;
    if (family && (!flow.source_ip || (flow.source_ip.includes(':') ? '6' : '4') !== family)) return false;
    const translated = !!(flow.translated_source_ip || flow.translated_destination_ip);
    if (translation === 'recorded' && !translated || translation === 'unrecorded' && translated) return false;
    if (period) {
      const start = Date.parse(flow.started_at || ''), end = Date.parse(flow.last_seen || '');
      if (!Number.isFinite(start) && !Number.isFinite(end)) return true; // Keep time-unknown evidence visible.
      if (Number.isFinite(start) && start > period.to || Number.isFinite(end) && end < period.from) return false;
    }
    return true;
  });
}
export function filterEvents(events: ConsoleEvent[], params: URLSearchParams): ConsoleEvent[] {
  const period = interval(params), severity = params.get('severity'), kind = params.get('kind');
  return events.filter(e => (!severity || e.severity === severity) && (!kind || e.kind === kind) && (!period || !e.time || !Number.isFinite(Date.parse(e.time)) || Date.parse(e.time) >= period.from && Date.parse(e.time) <= period.to));
}
