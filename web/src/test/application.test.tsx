import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../auth';
import { SourceCards } from '../components/SourceCards';
import { createDemo, demoSources } from '../lib/demo';
function fixtureAPI() {
  const demo = createDemo();
  const fetch = vi.fn(async (path: string, init?: RequestInit) => Response.json(await demo(path.slice('/api/v1'.length), init)));
  vi.stubGlobal('fetch', fetch); return fetch;
}
describe('routed application contract', () => {
  it.each([
    ['/overview', 'Overview', '/api/v1/overview?range=1h'],
    ['/overview?to=1600000000', 'Overview', '/api/v1/overview?from=&to=1600000000'],
    ['/overview?from=1500000000&to=1600000000', 'Overview', '/api/v1/overview?from=1500000000&to=1600000000'],
    ['/devices', 'Devices', '/api/v1/devices'], ['/traffic', 'Traffic', '/api/v1/flows'],
    ['/network', 'Network', '/api/v1/network'], ['/firewall', 'Firewall', '/api/v1/policies'], ['/events', 'Events', '/api/v1/events'], ['/system', 'System', '/api/v1/system'],
    ['/devices/device-a?tab=addresses', 'Example workstation', '/api/v1/devices/device-a'],
  ])('renders %s with a real API request', async (route, title, endpointPrefix) => {
    const fetch = fixtureAPI();
    render(<MemoryRouter initialEntries={[route]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();

    const { waitFor } = await import('@testing-library/react');
    await waitFor(() => {
      const calls = fetch.mock.calls.map(c => c[0]);
      expect(calls.some(url => url.startsWith(endpointPrefix))).toBe(true);
      expect(document.title).toBe(`${title} · Lanrith console`);
    });
    expect(screen.getByRole('link', { name: 'Lanrith console' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Lanrith' })).toBeInTheDocument();
  });
  it('presents collection evidence cards with status and observation detail', () => {
    render(<SourceCards sources={demoSources} />);
    const cards = screen.getByRole('list', { name: 'Collection evidence by source' });
    expect(cards).toBeInTheDocument();
    const policyCard = screen.getByText('Installed policy').closest('article')!;
    expect(policyCard).toHaveTextContent('stale');
    expect(policyCard).toHaveTextContent('Observed 34 min ago');
    expect(policyCard).toHaveTextContent('Last observed installed revision; current removal not established');
    expect(policyCard).not.toHaveTextContent('unavailable');
    const wirelessCard = screen.getByText('Wireless metrics').closest('article')!;
    expect(wirelessCard).toHaveTextContent('unsupported');
    expect(wirelessCard).toHaveTextContent('No observations recorded');
  });
  it('shows initial login after 401, provider outage, then accepts local recovery', async () => {
    const user = userEvent.setup();
    const fetch = vi.fn(async (path: string, init?: RequestInit) => {
      if (path === '/api/v1/session') return Response.json({ error: { code: 'unauthorized', message: 'Sign in.' } }, { status: 401 });
      if (path === '/api/v1/auth/methods') return Response.json({ local: true, oidc: { enabled: false, name: 'Configured provider' } });
      if (path === '/api/v1/auth/login') {
        expect(JSON.parse(String(init?.body))).toEqual({ username: 'local-account', password: 'example-input' });
        return Response.json({ user: { id: 'local', name: 'Local operator', role: 'operator' }, csrf_token: 'local-csrf', mode: 'production' });
      }
      return Response.json({ metrics: [], series: [], sources: [], events: [] });
    }); vi.stubGlobal('fetch', fetch);
    render(<MemoryRouter initialEntries={['/overview']}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByText('Identity provider unavailable')).toBeInTheDocument();
    expect(document.title).toBe('Sign in · Lanrith console');
    expect(screen.getByRole('img', { name: 'Lanrith' })).toBeInTheDocument();
    await user.type(screen.getByLabelText('Username'), 'local-account'); await user.type(screen.getByLabelText('Password'), 'example-input');
    await user.click(screen.getByRole('button', { name: 'Sign in locally' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Overview' })).toBeInTheDocument();
    expect(localStorage.getItem('password')).toBeNull();
  });
  it('reports startup failure instead of inventing observations', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    render(<MemoryRouter><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { name: 'Cannot connect to the console' })).toBeInTheDocument();
    expect(screen.queryByText('Example workstation')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry connection' })).toBeInTheDocument();
  });
});
