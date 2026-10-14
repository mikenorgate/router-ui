// Device surfaces aligned to the actual backend: current_inventory qualifies
// a removed device's identity as retained history (never current presence),
// console annotations stay writable for retained devices, the conntrack zone
// is a uint16 and renders as recorded, and bounded DNS/decision-timeline
// counts are labelled retained observations after sampling — not totals.
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { ObservationInspector } from '../components/ObservationInspector';
import { createDemo } from '../lib/demo';
import type { Observation } from '../lib/contracts';
import type { Collection, Device, DeviceDetail, Role, Session } from '../types';
import { DeviceDetailPage } from '../pages/DeviceDetailPage';

const sessionFor = (role: Role): Session => ({ user: { id: 'user', name: 'Evaluator', role }, csrf_token: 'test-csrf', mode: 'production' });

function fixtureAPI(role: Role = 'operator') {
  const demo = createDemo(role);
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    try { return Response.json(await demo(String(input).slice('/api/v1'.length), init)); }
    catch (error) { const e = error as { status?: number; code?: string; message?: string }; return Response.json({ error: { code: e.code, message: e.message } }, { status: e.status || 500 }); }
  });
  vi.stubGlobal('fetch', fetch);
  return fetch;
}

function renderDevice(route: string, role: Role = 'operator') {
  fixtureAPI(role);
  // The demo transport expects its own fixture CSRF token on writes.
  const session = { ...sessionFor(role), csrf_token: 'explicit-demo-csrf' };
  return render(<MemoryRouter initialEntries={[route]}><AuthProvider initialSession={session}><Routes><Route path="/devices/:id" element={<DeviceDetailPage />} /></Routes></AuthProvider></MemoryRouter>);
}

describe('retained historical devices (transport)', () => {
  it('serves removed devices with current_inventory:false, present devices with true', async () => {
    const demo = createDemo();
    const gone = await demo('/devices/device-gone') as DeviceDetail;
    expect(gone.current_inventory).toBe(false);
    expect(gone.device.status).toBe('historical');
    expect(gone.bindings?.some(b => b.valid_until)).toBe(true);
    expect((await demo('/devices/device-a') as DeviceDetail).current_inventory).toBe(true);
    // The /devices listing is the current inventory only — no history merged in.
    const list = await demo('/devices') as Collection<Device>;
    expect(list.items?.some(d => d.id === 'device-gone')).toBe(false);
  });
  it('keeps CSRF-protected annotations writable for retained historical devices', async () => {
    const demo = createDemo();
    await expect(demo('/devices/device-gone/annotation', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'csrf' });
    await demo('/devices/device-gone/annotation', { method: 'POST', headers: { 'X-CSRF-Token': 'explicit-demo-csrf' }, body: '{"alias":"Retired lab tablet","note":"Kept for audit"}' });
    expect((await demo('/devices/device-gone') as DeviceDetail).annotation?.alias).toBe('Retired lab tablet');
  });
});

describe('retained historical device page', () => {
  it('qualifies the identity as retained history without implying current inventory', async () => {
    renderDevice('/devices/device-gone');
    expect(await screen.findByText('Not in current inventory')).toBeInTheDocument();
    expect(screen.getAllByText('historical').length).toBeGreaterThan(0); // header status + Presence field
    expect(screen.getByText('Last recorded associations')).toBeInTheDocument();
    expect(screen.queryByText('Current associations')).not.toBeInTheDocument();
    const notice = screen.getByText(/retained history from the last observation/);
    expect(notice).toHaveTextContent('another device may hold these addresses now');
    // The stale-lease callout belongs to current devices only.
    expect(screen.queryByText('A stale lease or sleeping device does not prove disconnection.')).not.toBeInTheDocument();
  });
  it('keeps annotations editable on the retained record', async () => {
    const user = userEvent.setup();
    renderDevice('/devices/device-gone');
    const alias = await screen.findByLabelText('Console alias');
    expect(alias).toBeEnabled();
    await user.type(alias, 'Retired lab tablet');
    await user.click(screen.getByRole('button', { name: 'Save annotation' }));
    expect(await screen.findByText('Annotation saved.')).toBeInTheDocument();
  });
  it('keeps the current-inventory reading for present devices', async () => {
    renderDevice('/devices/device-a');
    expect(await screen.findByText('Current associations')).toBeInTheDocument();
    expect(screen.queryByText('Not in current inventory')).not.toBeInTheDocument();
    expect(screen.queryByText('Last recorded associations')).not.toBeInTheDocument();
    expect(screen.getByText('A stale lease or sleeping device does not prove disconnection.')).toBeInTheDocument();
  });
});

describe('device observation counts copy', () => {
  it('labels the DNS tab counts as retained observations after sampling, not totals', async () => {
    renderDevice('/devices/device-a?tab=dns');
    expect(await screen.findByText(/Counts are retained observations after raw-detail sampling, not totals/)).toBeInTheDocument();
    expect(await screen.findByText('service.example')).toBeInTheDocument();
  });
  it('labels the decision timeline counts as retained observations after sampling, not totals', async () => {
    renderDevice('/devices/device-a?tab=traffic');
    expect(await screen.findByText(/Counts are retained observations after raw-detail sampling, not totals/)).toBeInTheDocument();
  });
});

describe('backend field shapes', () => {
  it('renders a numeric (uint16) conntrack zone in the observation point', async () => {
    const observation: Observation = {
      identity: { ref: 'obs-flow-z', kind: 'flow', source_id: 'flow-observer', source_kind: 'Flow metadata', boot_id: 'boot-example-7f2c', record_id: 'seq-901', recorded_at: '2026-10-14T08:00:00Z' },
      record: {
        id: 'flow-z', device_id: 'device-a', source_ip: '192.0.2.24', destination_ip: '203.0.113.40',
        source_port: 50111, destination_port: 443, protocol: 'TCP', verdict: 'allowed', state: 'completed',
        namespace: 'forwarding', zone: 7, observation_point: 'egress-interface',
      },
    };
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(observation)));
    render(<MemoryRouter><AuthProvider initialSession={sessionFor('operator')}><ObservationInspector reference="obs-flow-z" onClose={() => undefined} /></AuthProvider></MemoryRouter>);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('forwarding · 7 · egress-interface')).toBeInTheDocument();
  });
});
