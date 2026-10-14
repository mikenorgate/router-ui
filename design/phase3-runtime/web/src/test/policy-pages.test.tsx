import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { request } from '../lib/api';
import { PolicyTable } from '../components/PolicyTable';
import { FirewallPage } from '../pages/FirewallPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import type { Collection, Policy, Source } from '../types';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return { ...actual, request: vi.fn() };
});

const mockRequest = request as unknown as ReturnType<typeof vi.fn>;
const session = { user: { id: 'test', name: 'Test', role: 'operator' as const }, csrf_token: '123', mode: 'production' as const };

function UrlProbe() {
  const [params] = useSearchParams();
  return <output data-testid="url">{params.toString()}</output>;
}
function renderFirewall(route: string) {
  return render(
    <AuthProvider initialSession={session}>
      <MemoryRouter initialEntries={[route]}>
        <Routes><Route path="/firewall" element={<FirewallPage />} /></Routes>
        <UrlProbe />
      </MemoryRouter>
    </AuthProvider>
  );
}
function renderDevice(route: string) {
  return render(
    <AuthProvider initialSession={session}>
      <MemoryRouter initialEntries={[route]}>
        <Routes><Route path="/devices/:id" element={<DeviceDetailPage />} /></Routes>
        <UrlProbe />
      </MemoryRouter>
    </AuthProvider>
  );
}
const rule = (id: string, extra: Partial<Policy> = {}): Policy => ({ id, action: 'allow', ...extra });
const page = (items: Policy[], next_cursor: string | null = null, sources: Source[] = []): Collection<Policy> => ({ items, next_cursor, sources });

describe('Firewall policy pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('sends server-side q/evidence/device_id filters and restores them from the URL', async () => {
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path.startsWith('/policies')) return page([rule('rule-042', { name: 'Restrict inter-segment traffic', origin: { producer: 'policy-adapter' } })]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall?q=segment&evidence=installed&device_id=device-a');
    expect(await screen.findByText('rule-042')).toBeInTheDocument();
    expect(requests).toEqual(['/policies?device_id=device-a&q=segment&evidence=installed&limit=100']);
    expect((screen.getByLabelText('Find a rule') as HTMLInputElement).value).toBe('segment');
    expect((screen.getByLabelText('Evidence') as HTMLSelectElement).value).toBe('installed');
    expect(screen.getByText('Device: device-a')).toBeInTheDocument();
    expect(screen.getByTestId('url').textContent).toContain('evidence=installed');
  });

  it('resets filters through Clear filters and refetches without them', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path.startsWith('/policies')) return page([rule('rule-010')]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall?q=segment&evidence=installed');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() => expect(requests).toContain('/policies?limit=100'));
    expect(screen.getByTestId('url').textContent).toBe('');
  });

  it('paginates explicitly beyond the first page and dedupes rules by application ID', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/policies?limit=100') return page([rule('rule-010')], '100');
      if (path === '/policies?limit=100&cursor=100') return page([rule('rule-042', { action: 'deny' }), rule('rule-010')]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-042');
    expect(requests).toEqual(['/policies?limit=100', '/policies?limit=100&cursor=100']);
    expect(screen.getAllByText('rule-010')).toHaveLength(1); // duplicate from page two shown once
    expect(screen.queryByRole('button', { name: 'Load more policies' })).not.toBeInTheDocument();
  });

  it('applies a filter change after the first page was loaded, resetting pagination', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/policies?limit=100') return page([rule('rule-010')], '100');
      if (path === '/policies?limit=100&cursor=100') return page([rule('rule-042', { action: 'deny' })]);
      if (path === '/policies?evidence=observed&limit=100') return page([rule('rule-777', { name: 'Observed match rule' })]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-042');
    await user.selectOptions(screen.getByLabelText('Evidence'), 'observed');
    expect(await screen.findByText('rule-777')).toBeInTheDocument();
    expect(screen.queryByText('rule-010')).not.toBeInTheDocument();
    expect(screen.queryByText('rule-042')).not.toBeInTheDocument();
    expect(requests).toEqual(['/policies?limit=100', '/policies?limit=100&cursor=100', '/policies?evidence=observed&limit=100']);
    expect(screen.getByTestId('url').textContent).toBe('evidence=observed');
  });

  it('paginates the new filtered query after a search change with loaded pages', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/policies?limit=100') return page([rule('rule-010')], '100');
      if (path === '/policies?limit=100&cursor=100') return page([rule('rule-042', { action: 'deny' })]);
      if (path === '/policies?q=grant&limit=100') return page([rule('rule-777', { name: 'Grant rule' })], '300');
      if (path === '/policies?q=grant&limit=100&cursor=300') return page([rule('rule-888', { action: 'deny' })]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-042');

    // Narrow the query; the first page under the new query still has a next cursor.
    await user.type(screen.getByLabelText('Find a rule'), 'grant');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('rule-777')).toBeInTheDocument();
    expect(screen.queryByText('rule-042')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    expect(await screen.findByText('rule-888')).toBeInTheDocument();
    expect(screen.getByText('rule-777')).toBeInTheDocument();
    expect(screen.queryByText('rule-010')).not.toBeInTheDocument();
    expect(screen.queryByText('rule-042')).not.toBeInTheDocument();
    expect(requests).toEqual([
      '/policies?limit=100',
      '/policies?limit=100&cursor=100',
      '/policies?q=grant&limit=100',
      '/policies?q=grant&limit=100&cursor=300',
    ]);
  });

  it('reconciles loaded pages after a refresh, replacing rows absent from the new snapshot', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    let firstCursor: string | null = '100';
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/policies?limit=100') return page([rule('rule-010')], firstCursor); // fresh object per fetch, like real JSON
      if (path === '/policies?limit=100&cursor=100') return page([rule('rule-042', { action: 'deny' })]);
      if (path === '/policies?limit=100&cursor=200') return page([rule('rule-055', { action: 'deny' })]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-042');

    // Refresh: the installed snapshot moved on; the old cursor chain is invalid.
    firstCursor = '200';
    requests.length = 0;
    await user.click(screen.getByRole('button', { name: 'Refresh snapshot' }));
    expect(await screen.findByText('rule-055')).toBeInTheDocument();
    expect(screen.queryByText('rule-042')).not.toBeInTheDocument();
    expect(requests).toEqual(['/policies?limit=100', '/policies?limit=100&cursor=200']);
  });

  it('retains stale rows and reports the failure when a refreshed page cannot be loaded', async () => {
    const user = userEvent.setup();
    let firstCursor: string | null = '100';
    let cursorCalls = 0;
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/policies?limit=100') return page([rule('rule-010')], firstCursor); // fresh object per fetch, like real JSON
      if (path === '/policies?limit=100&cursor=100') return page([rule('rule-042', { action: 'deny' })]);
      if (path === '/policies?limit=100&cursor=200') {
        cursorCalls++;
        if (cursorCalls === 1) throw new Error('Network timeout');
        return page([rule('rule-055', { action: 'deny' })]);
      }
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-042');

    firstCursor = '200';
    await user.click(screen.getByRole('button', { name: 'Refresh snapshot' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Refreshing the loaded pages failed; the previous page set is retained.');
    expect(alert).toHaveTextContent('Network timeout');
    expect(screen.getByText('rule-042')).toBeInTheDocument(); // stale page retained

    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('rule-055')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('ignores a canceled stale page request after the query changes', async () => {
    const user = userEvent.setup();
    let resolveSlow: (value: Collection<Policy>) => void = () => undefined;
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/policies?limit=100') return page([rule('rule-010')], '100');
      if (path === '/policies?limit=100&cursor=100') return new Promise(resolve => { resolveSlow = resolve; });
      if (path === '/policies?evidence=observed&limit=100') return page([rule('rule-777')]);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await user.selectOptions(screen.getByLabelText('Evidence'), 'observed');
    await act(async () => { resolveSlow(page([rule('rule-ghost')])); });
    expect(await screen.findByText('rule-777')).toBeInTheDocument();
    expect(screen.queryByText('rule-ghost')).not.toBeInTheDocument();
  });

  it('shows source coverage and original observation ages with fallbacks for missing fields', async () => {
    const sources: Source[] = [
      { id: 'policy-snapshot', kind: 'Installed policy', status: 'stale', observed_at: new Date(Date.now() - 34 * 60_000).toISOString(), lag_seconds: 2040, coverage: 'Last observed installed revision; current removal not established' },
      { id: 'partial-inventory', kind: 'Partial inventory', status: 'partial' },
    ];
    mockRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/policies')) return page([rule('rule-010')], null, sources);
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    const staleCard = screen.getByText('Installed policy').closest('article')!;
    expect(staleCard).toHaveTextContent('stale');
    expect(staleCard).toHaveTextContent('Observed 34 min ago');
    expect(staleCard).toHaveTextContent('Last observed installed revision; current removal not established');
    const partialCard = screen.getByText('Partial inventory').closest('article')!;
    expect(partialCard).toHaveTextContent('partial');
    expect(partialCard).toHaveTextContent('Coverage unavailable');
    expect(partialCard).toHaveTextContent('No observations recorded');
  });

  it('shows an unavailable fallback when the response omits policy sources', async () => {
    mockRequest.mockImplementation(async (path: string) => {
      if (path.startsWith('/policies')) return { items: [rule('rule-010')] };
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-010');
    expect(screen.getByText('Source coverage unavailable in this response.')).toBeInTheDocument();
  });

  it('explains the query limit when a full page arrives without a next cursor', async () => {
    const user = userEvent.setup();
    const firstHundred = Array.from({ length: 100 }, (_, i) => rule(`rule-${String(i).padStart(3, '0')}`));
    const secondHundred = Array.from({ length: 100 }, (_, i) => rule(`rule-1${String(i).padStart(3, '0')}`));
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/policies?limit=100') return page(firstHundred, '100');
      if (path === '/policies?limit=100&cursor=100') return { items: secondHundred, sources: [] }; // full page, no cursor: window cap
      throw new Error(`unexpected request ${path}`);
    });
    renderFirewall('/firewall');
    await screen.findByText('rule-000');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    expect(await screen.findByText(/query limit was reached/)).toBeInTheDocument();
    expect(screen.getByText(/matching rules beyond the limit are not shown/)).toBeInTheDocument();
    expect(screen.getByText(/arrow the search text or evidence filter/)).toBeInTheDocument();
    expect(screen.queryByText(/10,000|10000/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Load more policies' })).not.toBeInTheDocument();
  });

  it('treats blank or literal unknown producers as origin unavailable', () => {
    render(<PolicyTable policies={[
      rule('blank-producer', { origin: { producer: '' } }),
      rule('literal-unknown', { origin: { producer: 'unknown' } }),
      rule('named-producer', { origin: { producer: 'policy-adapter' } }),
    ]} onInspect={() => undefined} />);
    expect(screen.getAllByText('Origin unavailable')).toHaveLength(2);
    expect(screen.getByText('policy-adapter')).toBeInTheDocument();
  });
});

describe('Device firewall tab policy pages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('uses the embedded snapshot and policy_sources when unfiltered', async () => {
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/devices/dev1') return {
        device: { id: 'dev1', name: 'Lab device', observed_at: new Date().toISOString() },
        policies: [rule('rule-108', { name: 'Time-limited service grant' })],
        policies_next_cursor: null,
        policy_sources: [{ id: 'policy-snapshot', kind: 'Installed policy', status: 'stale', observed_at: new Date(Date.now() - 34 * 60_000).toISOString(), lag_seconds: 2040, coverage: 'Last observed installed revision' }],
        flows: [], events: [],
      };
      throw new Error(`unexpected request ${path}`);
    });
    renderDevice('/devices/dev1?tab=firewall');
    expect(await screen.findByText('rule-108')).toBeInTheDocument();
    expect(screen.getByText('Installed policy')).toBeInTheDocument();
    expect(screen.getByText(/Last observed installed revision/)).toBeInTheDocument();
    expect(requests.filter(r => r.startsWith('/policies'))).toEqual([]);
  });

  it('switches to the server-side filtered policies query when filters are set', async () => {
    const user = userEvent.setup();
    const requests: string[] = [];
    mockRequest.mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/devices/dev1') return {
        device: { id: 'dev1', observed_at: new Date().toISOString() },
        policies: [rule('rule-108')], policies_next_cursor: null, policy_sources: [], flows: [], events: [],
      };
      if (path === '/policies?device_id=dev1&q=grant&limit=100') return page([rule('rule-108'), rule('rule-200', { name: 'Grant rule' })]);
      throw new Error(`unexpected request ${path}`);
    });
    renderDevice('/devices/dev1?tab=firewall');
    await screen.findByText('rule-108');
    await user.type(screen.getByLabelText('Find a rule'), 'grant');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(await screen.findByText('rule-200')).toBeInTheDocument();
    expect(requests).toContain('/policies?device_id=dev1&q=grant&limit=100');
    expect(screen.getByTestId('url').textContent).toContain('q=grant');
    expect(screen.getAllByText('rule-108')).toHaveLength(1);
  });

  it('refreshes loaded device pages and retains them when the refetch fails', async () => {
    const user = userEvent.setup();
    let detail: Record<string, unknown> = {
      device: { id: 'dev1', observed_at: '2026-01-01T00:00:00Z' },
      policies: [rule('rule-108')], policies_next_cursor: 'cursor1', policy_sources: [], flows: [], events: [],
    };
    let cursorAFailed = false;
    mockRequest.mockImplementation(async (path: string) => {
      if (path === '/devices/dev1') return detail;
      if (path === '/policies?device_id=dev1&limit=100&cursor=cursor1') return page([rule('rule-200', { action: 'deny' })]);
      if (path === '/policies?device_id=dev1&limit=100&cursor=cursorA') {
        if (!cursorAFailed) { cursorAFailed = true; throw new Error('Policy source unavailable'); }
        return page([rule('rule-201', { action: 'deny' })]);
      }
      throw new Error(`unexpected request ${path}`);
    });
    renderDevice('/devices/dev1?tab=firewall');
    await screen.findByText('rule-108');
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    await screen.findByText('rule-200');

    // Background refresh moves the snapshot on; the loaded page cannot be refetched.
    detail = {
      device: { id: 'dev1', observed_at: '2026-01-01T00:05:00Z' },
      policies: [rule('rule-108')], policies_next_cursor: 'cursorA', policy_sources: [], flows: [], events: [],
    };
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Policy source unavailable');
    expect(screen.getByText('rule-200')).toBeInTheDocument(); // stale page retained

    // A later successful refresh reconciles the loaded page with the new snapshot.
    detail = {
      device: { id: 'dev1', observed_at: '2026-01-01T00:10:00Z' },
      policies: [rule('rule-108')], policies_next_cursor: 'cursorA', policy_sources: [], flows: [], events: [],
    };
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(await screen.findByText('rule-201')).toBeInTheDocument();
    expect(screen.queryByText('rule-200')).not.toBeInTheDocument();
  });
});
