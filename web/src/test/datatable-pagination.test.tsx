import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { request } from '../lib/api';
import { DataTable } from '../components/DataTable';
import { FirewallPage } from '../pages/FirewallPage';
import type { Collection, Policy } from '../types';

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

/** Deterministic fictional rules: rule-001…rule-N, packets equal to the ordinal so the global maximum is the last rule. */
const makeRules = (count: number): Policy[] => Array.from({ length: count }, (_, i) => ({
  id: `rule-${String(i + 1).padStart(3, '0')}`,
  name: `Fictional rule ${i + 1}`,
  action: i % 3 === 0 ? 'deny' : 'allow',
  scope: 'Router baseline',
  installed: i % 2 === 0,
  applicable: true,
  observed_match: null,
  origin: { producer: 'policy-adapter', revision: 'test-r1' },
  counters_scope: 'shared',
  packets: i + 1,
  bytes: (i + 1) * 128,
  observed_at: '2026-10-13T12:00:00.000Z',
}));

/** Stateful bounded policies endpoint mirroring the backend cursor contract. */
function mockPolicies(getRules: () => Policy[]) {
  mockRequest.mockImplementation(async (path: string) => {
    if (!path.startsWith('/policies')) throw new Error(`unexpected request ${path}`);
    const url = new URL(path, 'http://local.test');
    const limit = Number(url.searchParams.get('limit') || '100');
    const offset = Number(url.searchParams.get('cursor') || '0');
    let items = getRules();
    const q = (url.searchParams.get('q') || '').toLowerCase();
    if (q) items = items.filter(p => JSON.stringify(p).toLowerCase().includes(q));
    const evidence = url.searchParams.get('evidence') || '';
    if (evidence === 'installed') items = items.filter(p => p.installed === true);
    const pageItems = items.slice(offset, offset + limit);
    const collection: Collection<Policy> = {
      items: pageItems,
      next_cursor: offset + limit < items.length ? String(offset + limit) : null,
      sources: [],
    };
    return collection;
  });
}
const policyRequests = () => mockRequest.mock.calls.filter(call => String(call[0]).startsWith('/policies')).length;

const nextPage = () => screen.getByRole('button', { name: /Next page/ });
const previousPage = () => screen.getByRole('button', { name: /Previous page/ });
/** The loaded-range announcement; queried by text on full pages because they host other role=status regions. */
const rangeText = (expected: string) => screen.getByText(expected);
const bodyRows = () => screen.getAllByRole('row').slice(1); // drop the header row

interface UnitRow { id: string; name: string; value: number }
const unitRows = (count: number): UnitRow[] => Array.from({ length: count }, (_, i) => ({ id: `record-${String(i + 1).padStart(3, '0')}`, name: `Record ${i + 1}`, value: i + 1 }));
const unitColumns = [
  { key: 'name', label: 'Name', sort: (row: UnitRow) => row.name, render: (row: UnitRow) => row.id },
  { key: 'value', label: 'Recorded value', sort: (row: UnitRow) => row.value, render: (row: UnitRow) => <span className="mono">{row.value}</span> },
];

describe('DataTable default bounded page (pagination off)', () => {
  it('keeps the existing 200-row bounded page without pager controls', () => {
    render(<DataTable rows={unitRows(250)} caption="Fictional records." columns={unitColumns} />);
    expect(bodyRows()).toHaveLength(200);
    expect(screen.getByText('200 records in this bounded page')).toBeInTheDocument();
    expect(screen.queryByRole('navigation', { name: 'Loaded record pages' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Next page/ })).not.toBeInTheDocument();
  });
});

describe('DataTable client pagination', () => {
  it('pages through the loaded set with range, total and bounded controls', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={unitRows(230)} caption="Fictional records." columns={unitColumns} paginate pageSize={100} pageResetKey="unit" />);
    expect(bodyRows()).toHaveLength(100);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–100 of 230 loaded records');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    expect(previousPage()).toBeDisabled();
    await user.click(nextPage());
    expect(screen.getByRole('status')).toHaveTextContent('Showing 101–200 of 230 loaded records');
    await user.click(nextPage());
    expect(screen.getByRole('status')).toHaveTextContent('Showing 201–230 of 230 loaded records');
    expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    expect(nextPage()).toBeDisabled();
    await user.click(previousPage());
    expect(screen.getByRole('status')).toHaveTextContent('Showing 101–200 of 230 loaded records');
  });

  it('resets to the first page when the query context key changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataTable rows={unitRows(300)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="query-a" />);
    await user.click(nextPage());
    await user.click(nextPage());
    expect(screen.getByRole('status')).toHaveTextContent('Showing 201–300 of 300 loaded records');
    rerender(<DataTable rows={unitRows(300)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="query-b" />);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–100 of 300 loaded records');
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
  });

  it('clamps the current page when the loaded set shrinks', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<DataTable rows={unitRows(300)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="unit" />);
    await user.click(nextPage());
    await user.click(nextPage());
    expect(screen.getByRole('status')).toHaveTextContent('Showing 201–300 of 300 loaded records');
    rerender(<DataTable rows={unitRows(150)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="unit" />);
    expect(screen.getByRole('status')).toHaveTextContent('Showing 101–150 of 150 loaded records');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(nextPage()).toBeDisabled();
  });

  it('sorts the full loaded set before slicing the visible page', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={unitRows(250)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="unit" />);
    const sortButton = screen.getByRole('button', { name: 'Recorded value' });
    await user.click(sortButton); // ascending
    expect(bodyRows()[0]).toHaveTextContent('record-001');
    await user.click(sortButton); // descending: the global maximum lives beyond the first 100 rows in observation order
    expect(bodyRows()[0]).toHaveTextContent('record-250');
    expect(bodyRows()[99]).toHaveTextContent('record-151');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–100 of 250 loaded records');
  });

  it('operates the pager by keyboard', async () => {
    const user = userEvent.setup();
    render(<DataTable rows={unitRows(150)} caption="Fictional records." columns={unitColumns} paginate pageResetKey="unit" />);
    nextPage().focus();
    await user.keyboard('{Enter}');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 101–150 of 150 loaded records');
    previousPage().focus();
    await user.keyboard('[Space]');
    expect(screen.getByRole('status')).toHaveTextContent('Showing 1–100 of 150 loaded records');
  });
});

describe('Firewall policy client pagination (integration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
  });

  it('reaches and inspects rule-501 after loading every server page, without extra requests for client pages', async () => {
    const user = userEvent.setup();
    mockPolicies(() => makeRules(650));
    renderFirewall('/firewall');
    expect(await screen.findByText('Showing 1–100 of 100 loaded records')).toBeInTheDocument();
    // Server pagination is preserved: six bounded fetches of 100 rules each, then the cursor ends.
    for (let loaded = 100; loaded < 650; loaded += 100) {
      await user.click(screen.getByRole('button', { name: 'Load more policies' }));
      await screen.findByText(`Showing 1–100 of ${Math.min(650, loaded + 100)} loaded records`);
    }
    expect(screen.queryByRole('button', { name: 'Load more policies' })).not.toBeInTheDocument();
    expect(screen.getByText('Page 1 of 7')).toBeInTheDocument();
    expect(screen.queryByText('rule-501')).not.toBeInTheDocument();
    const fetched = policyRequests();
    expect(fetched).toBe(7);
    for (let i = 0; i < 5; i++) await user.click(nextPage());
    expect(rangeText('Showing 501–600 of 650 loaded records')).toBeInTheDocument();
    expect(screen.getByText('Page 6 of 7')).toBeInTheDocument();
    // Client paging must not issue further policy requests.
    expect(policyRequests()).toBe(fetched);
    const row = screen.getByText('rule-501').closest('tr')!;
    await user.click(within(row).getByRole('button', { name: 'Inspect rule rule-501' }));
    const dialog = await screen.findByRole('dialog', { name: 'Rule rule-501' });
    expect(within(dialog).getByText('Policy provenance')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('rule=rule-501');
    await user.click(within(dialog).getByRole('button', { name: 'Close ×' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The final page exposes the bounded end of the loaded set.
    await user.click(nextPage());
    expect(rangeText('Showing 601–650 of 650 loaded records')).toBeInTheDocument();
    expect(nextPage()).toBeDisabled();
    expect(policyRequests()).toBe(fetched);
  });

  it('returns to the first client page when the evidence filter changes', async () => {
    const user = userEvent.setup();
    mockPolicies(() => makeRules(300));
    renderFirewall('/firewall');
    await screen.findByText('Showing 1–100 of 100 loaded records');
    for (let loaded = 100; loaded < 300; loaded += 100) {
      await user.click(screen.getByRole('button', { name: 'Load more policies' }));
      await screen.findByText(`Showing 1–100 of ${loaded + 100} loaded records`);
    }
    await user.click(nextPage());
    expect(rangeText('Showing 101–200 of 300 loaded records')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Evidence'), 'installed');
    // The filtered query is a new bounded collection: only its first page is fetched.
    expect(await screen.findByText('Showing 1–100 of 100 loaded records')).toBeInTheDocument();
    expect(policyRequests()).toBe(4); // three paged fetches plus the filtered first page
    expect(String(mockRequest.mock.calls.at(-1)![0])).toContain('evidence=installed');
    // 150 of the 300 fictional rules are installed. Loading the rest keeps the view on page 1;
    // without a reset the previous page index (2 of 3) would survive as page 2 of 2 here.
    await user.click(screen.getByRole('button', { name: 'Load more policies' }));
    expect(await screen.findByText('Showing 1–100 of 150 loaded records')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  // Renders 300 rows across several page turns; allow more than the 5 s default.
  it('clamps the client page when a refreshed snapshot shrinks the loaded set', { timeout: 20_000 }, async () => {
    const user = userEvent.setup();
    let current = makeRules(300);
    mockPolicies(() => current);
    renderFirewall('/firewall');
    await screen.findByText('Showing 1–100 of 100 loaded records');
    for (let loaded = 100; loaded < 300; loaded += 100) {
      await user.click(screen.getByRole('button', { name: 'Load more policies' }));
      await screen.findByText(`Showing 1–100 of ${loaded + 100} loaded records`);
    }
    await user.click(nextPage());
    await user.click(nextPage());
    expect(rangeText('Showing 201–300 of 300 loaded records')).toBeInTheDocument();
    current = makeRules(150); // the refreshed snapshot holds fewer matching rules
    await user.click(screen.getByRole('button', { name: 'Refresh snapshot' }));
    await waitFor(() => expect(rangeText('Showing 101–150 of 150 loaded records')).toBeInTheDocument());
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(nextPage()).toBeDisabled();
  });
});
