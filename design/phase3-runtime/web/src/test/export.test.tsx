// Export surface: the demo transport routes /export through the same
// authoritative server-filter functions as the collections (filterFlows /
// filterDns), bounded to 500 records, rejecting unsupported kinds — and the
// ExportButton passes the selected URL filters, window and device upstream
// with a bounded completion message and the viewer restriction.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../auth';
import { ExportButton } from '../components/ExportButton';
import { createDemo } from '../lib/demo';
import type { DnsObservation, FlowWithRef } from '../lib/contracts';
import type { Role, Session } from '../types';

const at = (minutesAgo: number) => new Date(Date.now() - minutesAgo * 60_000).toISOString();
const sessionFor = (role: Role): Session => ({ user: { id: 'user', name: 'Evaluator', role }, csrf_token: 'test-csrf', mode: 'production' });

interface ExportBody { items: { id: string }[]; bounded: boolean; limit: number; exported_at: string }

describe('demo export transport', () => {
  it('exports nonempty flow records through filterFlows with the 500-record bound stated', async () => {
    const demo = createDemo();
    const body = await demo('/export?kind=flows') as ExportBody;
    expect(body.items.length).toBeGreaterThan(0);
    expect((body.items as FlowWithRef[]).every(f => f.id.startsWith('flow-') && !!f.observation_ref)).toBe(true);
    expect(body.bounded).toBe(true);
    expect(body.limit).toBe(500);
    expect(Number.isFinite(Date.parse(body.exported_at))).toBe(true);
  });
  it('exports nonempty DNS observations — never flow records — through filterDns', async () => {
    const demo = createDemo();
    const body = await demo('/export?kind=dns') as ExportBody;
    expect(body.items.length).toBe(4);
    const records = body.items as DnsObservation[];
    expect(records.every(d => d.id.startsWith('dns-'))).toBe(true);
    expect(records.every(d => !('source_ip' in d) && !('destination_ip' in d))).toBe(true);
    // Backend and legacy fixture shapes both survive the export.
    expect(records.find(d => d.id === 'dns-01')).toMatchObject({ query: 'service.example', result: 'NOERROR' });
    expect(records.find(d => d.id === 'dns-04')).toMatchObject({ query_name: 'updates.example', rcode: 'SERVFAIL' });
  });
  it('retains rcode, resolver and the window on DNS exports', async () => {
    const demo = createDemo();
    expect(((await demo('/export?kind=dns&rcode=NXDOMAIN') as ExportBody).items).map(d => d.id)).toEqual(['dns-03']);
    expect(((await demo('/export?kind=dns&resolver=upstream') as ExportBody).items).map(d => d.id)).toEqual(['dns-04']);
    const within = await demo(`/export?kind=dns&from=${at(10)}&to=${at(5)}`) as ExportBody;
    expect(within.items.map(d => d.id)).toEqual(['dns-01', 'dns-02']);
  });
  it('retains state, device_id and the window on flow exports', async () => {
    const demo = createDemo();
    expect(((await demo('/export?kind=flows&state=completed') as ExportBody).items).map(f => f.id)).toEqual(['flow-02']);
    expect(((await demo('/export?kind=flows&device_id=device-a') as ExportBody).items).length).toBe(3);
    expect(((await demo('/export?kind=flows&device_id=device-c') as ExportBody).items).length).toBe(0);
    const within = await demo(`/export?kind=flows&from=${at(4)}&to=${at(0)}`) as ExportBody;
    expect(within.items.map(f => f.id)).toEqual(['flow-02', 'flow-03']);
  });
  it('rejects unsupported kinds and denies Viewer for either kind', async () => {
    const demo = createDemo();
    await expect(demo('/export?kind=events')).rejects.toMatchObject({ status: 400, code: 'invalid_export' });
    await expect(demo('/export?kind=policies')).rejects.toMatchObject({ status: 400, code: 'invalid_export' });
    await expect(demo('/export')).rejects.toMatchObject({ status: 400, code: 'invalid_export' });
    const viewer = createDemo('viewer');
    await expect(viewer('/export?kind=dns')).rejects.toMatchObject({ status: 403, code: 'permission_denied' });
    await expect(viewer('/export?kind=flows')).rejects.toMatchObject({ status: 403, code: 'permission_denied' });
  });
});

describe('ExportButton component', () => {
  let clickedAnchor: HTMLAnchorElement | null;
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  const originalCreate = URL.createObjectURL;
  const originalRevoke = URL.revokeObjectURL;

  beforeEach(() => {
    clickedAnchor = null;
    createObjectURL = vi.fn(() => 'blob:example-export');
    revokeObjectURL = vi.fn();
    // jsdom has no blob URL store — stub both ends of the download channel.
    window.URL.createObjectURL = createObjectURL as unknown as typeof URL.createObjectURL;
    window.URL.revokeObjectURL = revokeObjectURL as unknown as typeof URL.revokeObjectURL;
    // The anchor never actually navigates; capture it for assertions.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) { clickedAnchor = this; });
  });
  afterEach(() => {
    window.URL.createObjectURL = originalCreate;
    window.URL.revokeObjectURL = originalRevoke;
  });

  function renderButton(route: string, props: { deviceId?: string | null; kind?: 'flows' | 'dns' }, role: Role = 'operator') {
    const fetch = vi.fn(async (input: RequestInfo | URL) => { void input; return Response.json({ items: [{ id: 'dns-01' }], bounded: true, limit: 500, exported_at: '2026-10-14T09:00:00Z' }); });
    vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={[route]}><AuthProvider initialSession={sessionFor(role)}><ExportButton {...props} /></AuthProvider></MemoryRouter>);
    return fetch;
  }

  it('sends the selected DNS filters, window and device upstream, then reports a bounded download', async () => {
    const user = userEvent.setup();
    const fetch = renderButton('/traffic?tab=dns&rcode=NXDOMAIN&from=2026-10-14T08:00:00Z&to=2026-10-14T09:00:00Z', { deviceId: 'device-a', kind: 'dns' });
    await user.click(screen.getByRole('button', { name: 'Export DNS' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Downloaded up to 500 matching DNS observations in the selected window.');
    const requested = decodeURIComponent(String(fetch.mock.calls[0]![0]));
    expect(requested).toContain('/api/v1/export?');
    expect(requested).toContain('kind=dns');
    expect(requested).toContain('rcode=NXDOMAIN');
    expect(requested).toContain('from=2026-10-14T08:00:00Z');
    expect(requested).toContain('to=2026-10-14T09:00:00Z');
    expect(requested).toContain('device_id=device-a');
    // Non-filter URL state (the active tab) is not an export predicate.
    expect(requested).not.toContain('tab=');
    // The download channel: blob URL from the response body, named anchor, no navigation.
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(clickedAnchor?.download).toBe('router-console-dns.json');
    expect(clickedAnchor?.href).toBe('blob:example-export');
  });

  it('defaults to the flows export with the flows message and filename', async () => {
    const user = userEvent.setup();
    const fetch = renderButton('/traffic', {});
    await user.click(screen.getByRole('button', { name: 'Export flows' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Downloaded up to 500 matching flow records in the selected window.');
    expect(decodeURIComponent(String(fetch.mock.calls[0]![0]))).toContain('kind=flows');
    expect(clickedAnchor?.download).toBe('router-console-flows.json');
  });

  it('disables export for Viewer with the restriction stated and no request fired', async () => {
    const user = userEvent.setup();
    const fetch = renderButton('/traffic?tab=dns', { kind: 'dns' }, 'viewer');
    const button = screen.getByRole('button', { name: 'Export DNS' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Export requires Operator or Administrator.')).toBeInTheDocument();
    await user.click(button);
    expect(fetch).not.toHaveBeenCalled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
