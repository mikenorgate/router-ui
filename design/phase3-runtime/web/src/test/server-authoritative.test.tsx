// Server-authoritative rendering: production pages must render the returned
// page exactly as the router filtered it. A record inside the response is
// never re-narrowed by a client-side time, verdict, severity or kind
// predicate — if it came back, it renders.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import type { Role, Session } from '../types';
import { TrafficPage } from '../pages/TrafficPage';
import { EventsPage } from '../pages/EventsPage';

const session = (role: Role = 'operator'): Session => ({ user: { id: 'user', name: 'Evaluator', role }, csrf_token: 'test-csrf', mode: 'production' });

/** Raw response map; the "server" applies nothing — whatever it returns is the page. */
function stubResponses(responses: Record<string, unknown>) {
  const fetch = vi.fn(async (input: RequestInfo | URL) => {
    const path = String(input).slice('/api/v1'.length);
    const route = Object.keys(responses).find(key => path.startsWith(key));
    return Response.json(route ? responses[route] : {});
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function Location() { const [params] = useSearchParams(); return <output data-testid="url">{params.toString()}</output>; }

function renderPage(element: React.ReactElement, route: string, role: Role = 'operator') {
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider initialSession={session(role)}>{element}<Location /></AuthProvider></MemoryRouter>);
}

describe('server-authoritative pages', () => {
  it('Traffic renders a returned flow whose verdict and times contradict the active filters', async () => {
    // Active filters: blocked verdicts inside a fixed window. The returned
    // page contains an allowed record outside that window; a client-side
    // filter would hide it, the server-authoritative page renders it.
    stubResponses({
      '/flows': {
        items: [{
          id: 'flow-x', device_id: 'device-a', source_ip: '192.0.2.24', destination_ip: '203.0.113.40',
          source_port: 50111, destination_port: 443, protocol: 'TCP', verdict: 'allowed', state: 'completed',
          started_at: '2026-10-10T00:00:00Z', last_seen: '2026-10-10T00:01:00Z', sampling_rate: 1,
        }],
      },
    });
    renderPage(<TrafficPage />, '/traffic?verdict=blocked&from=2026-10-14T08:00:00Z&to=2026-10-14T09:00:00Z');
    expect(await screen.findByRole('button', { name: 'Inspect flow flow-x' })).toBeInTheDocument();
    expect(screen.getByText('203.0.113.40:443')).toBeInTheDocument();
    // The request itself carried the predicates upstream.
    const paths = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls.map(call => String(call[0]));
    expect(paths.some(path => path.includes('verdict=blocked') && path.includes('from=2026-10-14'))).toBe(true);
  });

  it('Events renders a returned event outside the window and below the severity filter', async () => {
    stubResponses({
      '/events': {
        items: [{
          id: 'event-x', kind: 'telemetry', severity: 'info', time: '2026-10-01T00:00:00Z',
          title: 'Telemetry source restarted', detail: 'Returned by the server for this page.',
        }],
      },
    });
    renderPage(<EventsPage />, '/events?severity=critical&kind=mystery&from=2026-10-14T08:00:00Z&to=2026-10-14T09:00:00Z');
    expect(await screen.findByText('Telemetry source restarted')).toBeInTheDocument();
    // An active kind not in the known list stays visible in the selector.
    expect(screen.getByRole('option', { name: 'Unknown kind: mystery' })).toBeInTheDocument();
    // …while the previously missing kinds are now first-class options.
    for (const label of ['Telemetry', 'Network', 'Service', 'Clock'])
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
  });

  it('DNS rows show recorded answer values and TTLs, not a bare count', async () => {
    stubResponses({
      '/dns': {
        items: [{
          id: 'dns-x', device_id: 'device-a', query: 'service.example', type: 'A', result: 'NOERROR',
          answers: ['198.51.100.60', '198.51.100.61'],
          answer_records: [
            { name: 'service.example', type: 'A', value: '198.51.100.60', ttl: 300 },
            { name: 'service.example', type: 'A', value: '198.51.100.61', ttl: 45 },
          ],
          client_ip: '192.0.2.24', resolver: 'router-local', latency_ms: null, observed_at: '2026-10-14T08:30:00Z',
        }],
      },
    });
    renderPage(<TrafficPage />, '/traffic?tab=dns');
    expect(await screen.findByText(/198\.51\.100\.60/)).toBeInTheDocument();
    expect(screen.getByText(/TTL 300 s/)).toBeInTheDocument();
    expect(screen.getByText(/TTL 45 s/)).toBeInTheDocument();
    // Nullable latency stays unknown — never rendered as 0 ms.
    expect(screen.getByText('Latency unavailable')).toBeInTheDocument();
    expect(screen.queryByText('0 ms')).not.toBeInTheDocument();
  });
});
