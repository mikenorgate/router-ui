import type { Session } from '../types';
import { createDemo } from './demo';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); this.name = 'ApiError'; }
}
const initialParams = new URLSearchParams(window.location.search);
export const demoEnabled = initialParams.get('demo') === '1' || import.meta.env.VITE_DEMO_MODE === '1' || import.meta.env.VITE_DEMO_MODE === 'true';
const roleParam = initialParams.get('demo_role');
const demoRequest = createDemo(roleParam === 'viewer' || roleParam === 'admin' ? roleParam : 'operator');
let csrf = '';
export function setSession(session: Session | null) { csrf = session?.csrf_token || ''; }
export function validateSession(value: Session): Session {
  if (!value?.user?.id || !['viewer', 'operator', 'admin'].includes(value.user.role) || typeof value.csrf_token !== 'string' || !value.csrf_token) throw new ApiError(0, 'invalid_session', 'The API returned an incomplete session. Sign in again.');
  return value;
}
export function sameOriginPath(value?: string): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  try { const url = new URL(value, window.location.origin); return url.origin === window.location.origin && !url.username && !url.password ? url.pathname + url.search : null; } catch { return null; }
}
export async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith('/') || path.startsWith('//')) throw new ApiError(0, 'invalid_path', 'API path must be local.');
  const headers = new Headers(init.headers);
  if (init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase())) {
    // Initial local login has no authenticated session; use a token if already available.
    if (!csrf && path !== '/auth/login') throw new ApiError(403, 'csrf_missing', 'Session protection is unavailable. Sign in again.');
    if (csrf) headers.set('X-CSRF-Token', csrf);
    headers.set('Content-Type', 'application/json');
  }
  const options: RequestInit = { ...init, headers, credentials: 'same-origin' };
  try {
    if (demoEnabled) return await demoRequest(path, options) as T;
    const signal = init.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)]) : AbortSignal.timeout(20_000);
    const response = await fetch(`/api/v1${path}`, { ...options, signal });
    const body: unknown = response.status === 204 ? undefined : await response.json().catch(() => undefined);
    if (!response.ok) {
      const error = (body as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new ApiError(response.status, error?.code || 'request_failed', error?.message || `Request failed (${response.status}).`);
    }
    if (body === undefined && response.status !== 204 && (!init.method || ['GET', 'HEAD'].includes(init.method.toUpperCase()))) throw new ApiError(response.status, 'invalid_response', 'The API returned an unreadable response.');
    return body as T;
  } catch (error) {
    const e = error instanceof ApiError ? error : error instanceof Error ? error.name === 'AbortError' ? error : new ApiError(0, 'network_error', error.name === 'TimeoutError' ? 'Request timed out. Try again.' : 'Cannot reach the router API. Check the connection and retry.') : new ApiError((error as ApiError).status || 0, (error as ApiError).code || 'request_failed', (error as ApiError).message || 'Request failed.');
    if (e instanceof ApiError && e.status === 401 && path !== '/auth/login' && path !== '/session') window.dispatchEvent(new Event('console-session-expired'));
    throw e;
  }
}
export function query(path: string, params: Record<string, string | undefined | null>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  return `${path}${search.size ? `?${search}` : ''}`;
}
