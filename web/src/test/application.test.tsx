import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { AuthProvider } from '../auth';
import { createDemo } from '../lib/demo';
function fixtureAPI() {
  const demo = createDemo();
  const fetch = vi.fn(async (path: string, init?: RequestInit) => Response.json(await demo(path.slice('/api/v1'.length), init)));
  vi.stubGlobal('fetch', fetch); return fetch;
}
describe('routed application contract', () => {
  it.each([
    ['/overview', 'Overview', '/overview?range=1h'], ['/devices', 'Devices', '/devices'], ['/traffic', 'Traffic', '/flows?limit=50'],
    ['/network', 'Network', '/network'], ['/firewall', 'Firewall', '/policies'], ['/events', 'Events', '/events'], ['/system', 'System', '/system'],
    ['/devices/device-a?tab=addresses', 'Example workstation', '/devices/device-a'],
  ])('renders %s with a real API request', async (route, title, endpoint) => {
    const fetch = fixtureAPI();
    render(<MemoryRouter initialEntries={[route]}><AuthProvider><App /></AuthProvider></MemoryRouter>);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith(`/api/v1${endpoint}`, expect.objectContaining({ credentials: 'same-origin' }));
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
