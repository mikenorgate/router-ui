import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useSearchParams } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import { AuthProvider } from '../auth';
import { AnnotationEditor } from './AnnotationEditor';
import { Chart } from './Chart';
import { FlowDetail } from './FlowTable';
import { Inspector } from './Inspector';
import { PolicyTable } from './PolicyTable';
import { Tabs } from './UI';
import { TrafficPage } from '../pages/TrafficPage';
import { demoFlows, demoPolicies } from '../lib/demo';
import { bytes, number } from '../lib/format';
const session = { user: { id: 'user', name: 'Operator', role: 'operator' as const }, csrf_token: 'test-csrf', mode: 'production' as const };
describe('investigation interactions', () => {
  it('filters flows through URL state and opens/closes a real inspector', async () => {
    const user = userEvent.setup();
    vi.stubGlobal('fetch', vi.fn().mockImplementation(async () => Response.json({ items: demoFlows })));
    function Location() { const [p] = useSearchParams(); return <output data-testid="url">{p.toString()}</output>; }
    render(<MemoryRouter initialEntries={['/traffic']}><AuthProvider initialSession={session}><TrafficPage /><Location /></AuthProvider></MemoryRouter>);
    await screen.findByRole('button', { name: 'Inspect flow flow-01' });
    await user.selectOptions(screen.getByLabelText('Verdict'), 'unknown');
    expect(screen.queryByRole('button', { name: 'Inspect flow flow-01' })).not.toBeInTheDocument();
    expect(screen.getByTestId('url')).toHaveTextContent('verdict=unknown');
    await user.click(await screen.findByRole('button', { name: 'Inspect flow flow-03' }));
    expect(globalThis.fetch).toHaveBeenLastCalledWith(expect.stringContaining('verdict=unknown'), expect.any(Object));
    expect(screen.getByRole('dialog')).toHaveAttribute('open');
    expect(screen.getByRole('dialog')).toHaveTextContent('Hook path');
    expect(screen.getByRole('dialog')).toHaveTextContent('Not supplied by this API');
    await user.click(screen.getByRole('button', { name: 'Close ×' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Inspect flow flow-03' })).toHaveFocus();
  });
  it('denies Viewer traffic without making a sensitive request', () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter><AuthProvider initialSession={{ ...session, user: { ...session.user, role: 'viewer' } }}><TrafficPage /></AuthProvider></MemoryRouter>);
    expect(screen.getByText('Permission limited')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export flows' })).toBeDisabled();
    expect(fetch).not.toHaveBeenCalled();
  });
  it('preserves unsaved annotation text after a failed request and sends CSRF', async () => {
    const user = userEvent.setup(), saved = vi.fn();
    const fetch = vi.fn().mockResolvedValue(Response.json({ error: { code: 'storage_full', message: 'Annotation budget exhausted.' } }, { status: 507 })); vi.stubGlobal('fetch', fetch);
    render(<AuthProvider initialSession={session}><AnnotationEditor deviceId="device-a" onSaved={saved} /></AuthProvider>);
    await user.type(screen.getByLabelText('Console alias'), 'Local alias'); await user.type(screen.getByLabelText('Console note'), 'Keep this draft');
    await user.click(screen.getByRole('button', { name: 'Save annotation' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Annotation budget exhausted.');
    expect(screen.getByLabelText('Console note')).toHaveValue('Keep this draft');
    expect(saved).not.toHaveBeenCalled();
    expect(new Headers((fetch.mock.calls[0]![1] as RequestInit).headers).get('X-CSRF-Token')).toBe('test-csrf');
  });
  it('renders hostile API names as text and keeps shared counters labelled', () => {
    const hostile = '<img src=x onerror=alert(1)>';
    const { container } = render(<PolicyTable policies={[{ ...demoPolicies[0]!, name: hostile }]} onInspect={() => undefined} />);
    expect(screen.getByText(hostile)).toBeInTheDocument(); expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Shared rule counter')).toBeInTheDocument();
    expect(screen.getByText('Installed')).toBeInTheDocument(); expect(screen.getByText('Applicable')).toBeInTheDocument(); expect(screen.getByText('Observed match')).toBeInTheDocument();
  });
  it('supports arrow/Home/End tab navigation', async () => {
    const user = userEvent.setup();
    function DetailTabs() { const [tab, setTab] = useState('summary'); return <Tabs items={['summary', 'traffic', 'firewall']} selected={tab} onSelect={setTab} />; }
    render(<DetailTabs />); screen.getByRole('tab', { name: 'Summary' }).focus();
    await user.keyboard('{ArrowRight}'); expect(screen.getByRole('tab', { name: 'Traffic' })).toHaveFocus();
    await user.keyboard('{End}'); expect(screen.getByRole('tab', { name: 'Firewall' })).toHaveAttribute('aria-selected', 'true');
    await user.keyboard('{Home}'); expect(screen.getByRole('tab', { name: 'Summary' })).toHaveFocus();
  });
  it('retains gaps in SVG paths and provides exact chart values', () => {
    render(<Chart series={[{ id: 'rx', unit: 'Mbit/s', points: [{ time: '2026-10-12T09:00:00Z', value: 12 }, { time: '2026-10-12T09:01:00Z', value: null }, { time: '2026-10-12T09:02:00Z', value: 4 }] }]} />);
    const paths = document.querySelector('.chart-line')?.getAttribute('d'); expect(paths?.match(/M/g)).toHaveLength(2);
    expect(screen.getByText('Missing sample')).toBeInTheDocument(); expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });
  it('closes an inspector on Escape/cancel', async () => {
    const onClose = vi.fn(); render(<Inspector title="Evidence" onClose={onClose}>Unknown</Inspector>);
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { bubbles: true, cancelable: true }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });
  it('does not turn missing counters into zeros or infer translation', () => {
    expect(bytes(undefined)).toBe('Unavailable'); expect(number(null)).toBe('Unavailable'); expect(number(0)).toBe('0');
    render(<MemoryRouter><FlowDetail flow={demoFlows[2]!} /></MemoryRouter>);
    expect(screen.getByText('No translation recorded; none is inferred.')).toBeInTheDocument();
  });
});
