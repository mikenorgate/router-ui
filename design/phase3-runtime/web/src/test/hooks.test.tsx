// URL filter-state contract. setWindow is atomic (one navigation writes both
// bounds and drops range/cursor — two consecutive set() calls used to read
// the same stale params and lose `from`), opening an observation preserves
// the list cursor it came from, clearing filters keeps the explicit window
// and tab, and a cross-page href with a fixed window drops the relative range.
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useFilters } from '../lib/hooks';

const FROM = '2026-10-14T08:00:00.000Z';
const TO = '2026-10-14T08:05:00.000Z';

function Harness() {
  const filters = useFilters();
  return <>
    <output data-testid="url">{decodeURIComponent(filters.params.toString())}</output>
    <output data-testid="traffic-href">{decodeURIComponent(filters.href('/traffic', { from: FROM, to: TO }))}</output>
    <button onClick={() => filters.setWindow(FROM, TO)}>Select window</button>
    <button onClick={() => filters.set('observation', 'obs-flow-02')}>Open observation</button>
    <button onClick={() => filters.set('observation', '')}>Close observation</button>
    <button onClick={filters.clear}>Clear</button>
  </>;
}

function renderAt(route: string) {
  return render(<MemoryRouter initialEntries={[route]}><Harness /></MemoryRouter>);
}

describe('useFilters URL state', () => {
  it('setWindow writes from and to in one navigation, dropping range and cursor', async () => {
    const user = userEvent.setup();
    renderAt(`/traffic?range=1h&cursor=c2&state=active`);
    await user.click(screen.getByRole('button', { name: 'Select window' }));
    const url = screen.getByTestId('url').textContent!;
    expect(url).toContain(`from=${FROM}`);
    expect(url).toContain(`to=${TO}`);
    expect(url).not.toContain('range=');
    expect(url).not.toContain('cursor=');
    // Unrelated predicates survive the window change.
    expect(url).toContain('state=active');
  });

  it('opening and closing an observation preserves the list cursor', async () => {
    const user = userEvent.setup();
    renderAt('/traffic?cursor=c2&verdict=blocked');
    await user.click(screen.getByRole('button', { name: 'Open observation' }));
    let url = screen.getByTestId('url').textContent!;
    expect(url).toContain('observation=obs-flow-02');
    expect(url).toContain('cursor=c2');
    expect(url).toContain('verdict=blocked');
    await user.click(screen.getByRole('button', { name: 'Close observation' }));
    url = screen.getByTestId('url').textContent!;
    expect(url).not.toContain('observation=');
    expect(url).toContain('cursor=c2');
  });

  it('clearing filters keeps the fixed window and tab but drops predicates and cursor', async () => {
    const user = userEvent.setup();
    renderAt(`/devices/device-a?tab=traffic&from=${encodeURIComponent(FROM)}&to=${encodeURIComponent(TO)}&q=rule-042&cursor=c3`);
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    const url = screen.getByTestId('url').textContent!;
    expect(url).toContain(`from=${FROM}`);
    expect(url).toContain(`to=${TO}`);
    expect(url).toContain('tab=traffic');
    expect(url).not.toContain('q=');
    expect(url).not.toContain('cursor=');
  });

  it('clearing with a relative range keeps the range', async () => {
    const user = userEvent.setup();
    renderAt('/events?range=24h&severity=warning');
    await user.click(screen.getByRole('button', { name: 'Clear' }));
    const url = screen.getByTestId('url').textContent!;
    expect(url).toContain('range=24h');
    expect(url).not.toContain('severity=');
  });

  it('a cross-page href carrying a fixed window drops the relative range', () => {
    renderAt('/overview?range=1h');
    const href = screen.getByTestId('traffic-href').textContent!;
    expect(href).toBe(`/traffic?from=${FROM}&to=${TO}`);
  });
});
