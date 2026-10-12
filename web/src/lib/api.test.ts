import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, query, request, sameOriginPath, setSession } from './api';
const session = { user: { id: 'user', name: 'Operator', role: 'operator' as const }, csrf_token: 'test-csrf', mode: 'production' as const };
beforeEach(() => setSession(null));
describe('API trust boundaries', () => {
  it('uses same-origin cookies and exact contract paths', async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({ items: [] })); vi.stubGlobal('fetch', fetch);
    await request(query('/flows', { q: '<device>&', limit: '50', device_id: null }));
    expect(fetch).toHaveBeenCalledWith('/api/v1/flows?q=%3Cdevice%3E%26&limit=50', expect.objectContaining({ credentials: 'same-origin' }));
  });
  it('sends CSRF for annotation and logout without persisting tokens', async () => {
    setSession(session); const fetch = vi.fn().mockResolvedValue(new Response(null, { status: 204 })); vi.stubGlobal('fetch', fetch);
    await request('/devices/device-a/annotation', { method: 'POST', body: JSON.stringify({ alias: 'Example', note: '' }) });
    await request('/auth/logout', { method: 'POST' });
    for (const call of fetch.mock.calls) expect(new Headers((call[1] as RequestInit).headers).get('X-CSRF-Token')).toBe('test-csrf');
    expect(localStorage.getItem('csrf_token')).toBeNull();
  });
  it('blocks authenticated writes without a session token', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    await expect(request('/devices/a/annotation', { method: 'POST' })).rejects.toMatchObject({ code: 'csrf_missing' });
    expect(fetch).not.toHaveBeenCalled();
  });
  it('keeps backend errors and never substitutes fixtures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'source_down', message: 'Source unavailable.' } }, { status: 503 })));
    await expect(request('/overview')).rejects.toEqual(new ApiError(503, 'source_down', 'Source unavailable.'));
  });
  it('preserves network failures as explicit errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(request('/devices')).rejects.toMatchObject({ code: 'network_error' });
  });
  it('expires the session when a protected request returns 401', async () => {
    const listener = vi.fn(); window.addEventListener('console-session-expired', listener);
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(Response.json({ error: { code: 'expired', message: 'Session expired.' } }, { status: 401 })));
    await expect(request('/flows')).rejects.toMatchObject({ status: 401 }); expect(listener).toHaveBeenCalledOnce(); window.removeEventListener('console-session-expired', listener);
  });
  it('rejects external OIDC URLs and accepts the configured local redirect', () => {
    expect(sameOriginPath('/auth/oidc/login')).toBe('/auth/oidc/login');
    for (const path of ['https://other.example', '//other.example/login', '/\\other.example', 'javascript:alert(1)']) expect(sameOriginPath(path)).toBeNull();
  });
});
