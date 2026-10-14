// Phase 3 surface tests: the integrated pages rendered against the fixture
// transport. Covers the preserved policy-phase surfaces (metrics, device
// firewall, annotations), the new investigation surfaces (interval summary,
// ranking, DNS, exposure, linked events, direct references), the role
// checks, and the removal of simulated outcomes.
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { createDemo } from '../lib/demo';
import type { Role, Session } from '../types';
import { OverviewPage } from '../pages/OverviewPage';
import { TrafficPage } from '../pages/TrafficPage';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { EventsPage } from '../pages/EventsPage';
import { NetworkExposurePage } from '../pages/NetworkExposurePage';
import { AccessExplanationPage } from '../pages/AccessExplanationPage';

const sessionFor = (role: Role): Session => ({ user: { id: 'user', name: 'Evaluator', role }, csrf_token: 'test-csrf', mode: 'production' });

function fixtureAPI(role: Role = 'operator') {
  const demo = createDemo(role);
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    try { return Response.json(await demo(url.slice('/api/v1'.length), init)); }
    catch (error) { const e = error as { status?: number; code?: string; message?: string }; return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status || 500 }); }
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function Location() { const [params] = useSearchParams(); return <output data-testid="url">{params.toString()}</output>; }

function renderPage(element: React.ReactElement, route: string, role: Role = 'operator') {
  fixtureAPI(role);
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider initialSession={sessionFor(role)}>{element}<Location /></AuthProvider></MemoryRouter>);
}

/** Pages that read path parameters need a matching route pattern. */
function renderRouted(path: string, element: React.ReactElement, route: string, role: Role = 'operator') {
  fixtureAPI(role);
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider initialSession={sessionFor(role)}><Routes><Route path={path} element={element} /></Routes><Location /></AuthProvider></MemoryRouter>);
}

describe('Overview investigation surfaces (metrics preserved)', () => {
  it('keeps the metric strip and adds ranking, accounting, gaps and the unattributed bucket', async () => {
    renderPage(<OverviewPage />, '/overview');
    expect(await screen.findByText('Interface receive rate')).toBeInTheDocument(); // preserved metric strip
    expect((await screen.findAllByText('Unattributed bucket')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Live interval accounting').length).toBeGreaterThan(0);
    expect(screen.getByText('1 measurement gap')).toBeInTheDocument();
    expect(screen.getByText(/Shares cover attributed traffic only/)).toBeInTheDocument();
    expect(screen.getByText('Sources and freshness')).toBeInTheDocument();
    // Accounting-point qualifier, truncation and the no-summing note.
    expect(screen.getAllByText(/wan-egress/).length).toBeGreaterThan(0);
    expect(screen.getByText(/truncated this ranking/)).toBeInTheDocument();
    expect(screen.getByText(/never summed together/)).toBeInTheDocument();
  });
  it('opens the observation behind a ranking row and closes it via the URL state', async () => {
    const user = userEvent.setup();
    renderPage(<OverviewPage />, '/overview');
    await user.click(await screen.findByRole('button', { name: 'Inspect top observation for device-a at forwarding · wan-egress' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('seq-1177')).toBeInTheDocument();
    expect(within(dialog).getByText('boot-example-7f2c')).toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('observation=obs-flow-02');
    await user.click(within(dialog).getByRole('button', { name: 'Close ×' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).not.toHaveTextContent('observation=');
  });
  it('keeps unmeasured reconciliation and null ranking bytes unknown, never zero', async () => {
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-b?tab=traffic');
    // Scoped summary omits interface-byte reconciliation entirely.
    expect(await screen.findByText('Shared time window')).toBeInTheDocument();
    expect(screen.queryByText(/interface bytes/)).not.toBeInTheDocument();
    expect(screen.queryByText('0 B')).not.toBeInTheDocument();
  });
});

describe('Traffic investigation surfaces', () => {
  it('deep-links an observation outside the filtered list page by reference', async () => {
    const user = userEvent.setup();
    renderPage(<TrafficPage />, '/traffic?verdict=blocked&observation=obs-flow-02');
    // The bounded list is filtered to blocked verdicts: flow-02 is not a row.
    expect(await screen.findByRole('button', { name: 'Inspect flow flow-01' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Inspect flow flow-02' })).not.toBeInTheDocument();
    // …yet its reference resolves in the inspector, with identity visible.
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('seq-1177')).toBeInTheDocument();
    expect(within(dialog).getByText(/203\.0\.113\.40/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Close ×' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).not.toHaveTextContent('observation=');
    expect(screen.getByTestId('url')).toHaveTextContent('verdict=blocked');
  });
  it('reaches the DNS tab by arrow key and renders resolver observations', async () => {
    renderPage(<TrafficPage />, '/traffic');
    const flowsTab = await screen.findByRole('tab', { name: 'Flows' });
    flowsTab.focus();
    fireEvent.keyDown(flowsTab, { key: 'ArrowRight' });
    expect(screen.getByRole('tab', { name: 'DNS' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'DNS' })).toHaveFocus();
    expect(await screen.findByText('service.example')).toBeInTheDocument();
    expect(screen.getAllByText(/do not identify applications/).length).toBeGreaterThan(0);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Inspect DNS observation dns-01' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('seq-5520')).toBeInTheDocument();
  });
  it('denies Viewer detail without requesting flows or DNS', () => {
    const fetch = fixtureAPI('viewer');
    render(<MemoryRouter initialEntries={['/traffic']}><AuthProvider initialSession={sessionFor('viewer')}><TrafficPage /></AuthProvider></MemoryRouter>);
    expect(screen.getByText('Permission limited')).toBeInTheDocument();
    const paths = fetch.mock.calls.map(call => String(call[0]));
    expect(paths.some(path => path.startsWith('/api/v1/flows'))).toBe(false);
    expect(paths.some(path => path.startsWith('/api/v1/dns'))).toBe(false);
  });
});

describe('Device time-window surfaces (firewall and annotations preserved)', () => {
  it('keeps annotations on the summary tab and policy pages on the firewall tab', async () => {
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-a');
    expect(await screen.findByText('Console annotations')).toBeInTheDocument();
    expect(screen.getByLabelText('Console alias')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Firewall' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Dns' })).toBeInTheDocument();
  });
  it('renders the device firewall tab from the embedded snapshot', async () => {
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-a?tab=firewall');
    expect(await screen.findByText('rule-042')).toBeInTheDocument();
    expect(screen.getByText('Policy affecting this device')).toBeInTheDocument();
  });
  it('renders shared-window lanes and ref-backed conversations on the traffic tab', async () => {
    const user = userEvent.setup();
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-a?tab=traffic');
    expect(await screen.findByText('Shared time window')).toBeInTheDocument();
    expect((await screen.findAllByText(/Attributed devices/)).length).toBeGreaterThan(0);
    await user.click(await screen.findByRole('button', { name: 'Inspect flow flow-01' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('seq-1184')).toBeInTheDocument();
    // Flow observation detail shows observation point, revision and binding.
    expect(within(dialog).getByText(/egress-interface/)).toBeInTheDocument();
    expect(within(dialog).getByText(/example-r42/)).toBeInTheDocument();
    expect(within(dialog).getByText(/binding-192-0-2-24/)).toBeInTheDocument();
  });
  it('selects an interval atomically: one navigation writes from and to, dropping range and cursor', async () => {
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-a?tab=traffic&range=1h');
    const lanes = await screen.findByRole('img');
    fireEvent.keyDown(lanes, { key: 'ArrowRight' });
    fireEvent.keyDown(lanes, { key: 'Enter' });
    const url = decodeURIComponent(screen.getByTestId('url').textContent!);
    expect(url).toContain('from=');
    expect(url).toContain('to=');
    expect(url).not.toContain('range=');
    expect(url).not.toContain('cursor=');
    expect(url).toContain('tab=traffic');
  });
  it('opens summary recent conversations by observation reference when present', async () => {
    const user = userEvent.setup();
    const demo = createDemo();
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).slice('/api/v1'.length);
      if (path.startsWith('/devices/device-a')) {
        const detail = await demo(path, init) as { flows?: unknown[] };
        // A device payload whose recent conversations carry references.
        return Response.json({ ...detail, flows: [{ id: 'flow-x', device_id: 'device-a', source_ip: '192.0.2.24', destination_ip: '203.0.113.40', protocol: 'TCP', verdict: 'allowed', observation_ref: 'obs-flow-02' }] });
      }
      try { return Response.json(await demo(path, init)); }
      catch (error) { const e = error as { status?: number; code?: string; message?: string }; return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status || 500 }); }
    }));
    render(<MemoryRouter initialEntries={['/devices/device-a']}><AuthProvider initialSession={sessionFor('operator')}><Routes><Route path="/devices/:id" element={<DeviceDetailPage />} /></Routes><Location /></AuthProvider></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: 'Inspect flow flow-x' }));
    expect(screen.getByTestId('url')).toHaveTextContent('observation=obs-flow-02');
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('seq-1177')).toBeInTheDocument();
  });
  it('renders resolver observations with answer values and TTLs on the DNS tab', async () => {
    renderRouted('/devices/:id', <DeviceDetailPage />, '/devices/device-a?tab=dns');
    expect(await screen.findByText('service.example')).toBeInTheDocument();
    expect(screen.getByText('DNS in window')).toBeInTheDocument();
    expect(screen.getAllByText(/TTL 300 s/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/198\.51\.100\.60/).length).toBeGreaterThan(0);
  });
});

describe('Events, exposure and access explanation', () => {
  it('applies severity as a server filter, restates it, and links the denial event to its observation', async () => {
    const user = userEvent.setup();
    renderPage(<EventsPage />, '/events?severity=warning');
    expect(await screen.findByText(/Server filters applied: warning/)).toBeInTheDocument();
    expect(screen.getByText('Attributed connection denial')).toBeInTheDocument();
    expect(screen.queryByText('IPv6 address association observed')).not.toBeInTheDocument(); // info event filtered out server-side
    await user.click(screen.getByRole('button', { name: 'Inspect observation behind event event-1' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('evt-0091')).toBeInTheDocument();
  });
  it('shows configured exposure with per-row uncertainty, preserved conditions and no reachability claim', async () => {
    renderPage(<NetworkExposurePage />, '/network/exposure');
    expect(await screen.findByText('Router listeners')).toBeInTheDocument();
    expect(screen.getByText('Router console (this interface)')).toBeInTheDocument();
    expect(screen.getAllByText(/never verified/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Shared rule counter/)).toBeInTheDocument();
    expect(screen.getByText(/Last confirmed 34 minutes ago; snapshot is stale/)).toBeInTheDocument();
    // Inbound policy names and conditions survive verbatim.
    expect(screen.getByText('Allow inbound forward')).toBeInTheDocument();
    expect(screen.getByText(/198\.51\.100\.0\/24 → 192\.0\.2\.24:8443 · TCP/)).toBeInTheDocument();
  });
  it('explains an observed denial with recorded policy context, related events and unresolved questions — no simulation', async () => {
    renderRouted('/investigations/:ref', <AccessExplanationPage />, '/investigations/inv-access-flow-01');
    expect(await screen.findByText('Observed decision')).toBeInTheDocument();
    expect(screen.getByText('Recorded policy context')).toBeInTheDocument();
    expect(screen.queryByText('Policy path')).not.toBeInTheDocument();
    expect(screen.getByText(/may contain only one historically retained rule/)).toBeInTheDocument();
    expect(screen.getByText('rule-042')).toBeInTheDocument();
    // Related events from the investigation payload render with their links.
    expect(screen.getByText('Related events')).toBeInTheDocument();
    expect(screen.getAllByText('Attributed connection denial').length).toBeGreaterThan(0);
    expect(screen.getByText('Unresolved questions')).toBeInTheDocument();
    expect(screen.queryByText(/[Ss]imulat/)).not.toBeInTheDocument();
  });
  it('keeps an unobserved subject unknown without inventing an outcome', async () => {
    renderRouted('/investigations/:ref', <AccessExplanationPage />, '/investigations/inv-access-flow-03');
    expect(await screen.findByText('No observed decision')).toBeInTheDocument();
    expect(screen.getByText(/No outcome is inferred/)).toBeInTheDocument();
    expect(screen.queryByText(/[Ss]imulat/)).not.toBeInTheDocument();
  });
  it('denies Viewer investigations while summary surfaces remain', async () => {
    renderRouted('/investigations/:ref', <AccessExplanationPage />, '/investigations/inv-access-flow-01', 'viewer');
    expect(await screen.findByText('Permission limited')).toBeInTheDocument();
    renderPage(<OverviewPage />, '/overview', 'viewer');
    expect((await screen.findAllByText('Unattributed bucket')).length).toBeGreaterThan(0);
  });
});
