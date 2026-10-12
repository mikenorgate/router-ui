import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from './types';
import { ApiError, request, setSession, validateSession } from './lib/api';
interface AuthState { session: Session | null; loading: boolean; error?: Error; expired: boolean; accept: (session: Session | null) => void; retry: () => void }
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children, initialSession }: { children: ReactNode; initialSession?: Session }) {
  const [session, updateSession] = useState<Session | null>(initialSession || null);
  const [loading, setLoading] = useState(!initialSession);
  const [error, setError] = useState<Error>();
  const [expired, setExpired] = useState(false);
  const [generation, setGeneration] = useState(0);
  const accept = (value: Session | null) => { setSession(value); updateSession(value); setError(undefined); setLoading(false); setExpired(false); };
  useEffect(() => {
    if (initialSession) { setSession(initialSession); return; }
    const controller = new AbortController();
    setLoading(true); setError(undefined);
    request<Session>('/session', { signal: controller.signal }).then(value => { if (!controller.signal.aborted) accept(validateSession(value)); }).catch((e: unknown) => {
      if (controller.signal.aborted) return;
      setSession(null); updateSession(null); setLoading(false);
      if (!(e instanceof ApiError && e.status === 401)) setError(e instanceof Error ? e : new Error('Cannot load session.'));
    });
    return () => controller.abort();
  }, [generation, initialSession]);
  useEffect(() => {
    const listener = () => { setSession(null); updateSession(null); setExpired(true); };
    window.addEventListener('console-session-expired', listener);
    return () => window.removeEventListener('console-session-expired', listener);
  }, []);
  return <AuthContext.Provider value={{ session, loading, error, expired, accept, retry: () => setGeneration(g => g + 1) }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const value = useContext(AuthContext); if (!value) throw new Error('AuthProvider is required'); return value; }
