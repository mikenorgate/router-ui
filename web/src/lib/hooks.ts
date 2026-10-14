import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ApiError, demoEnabled, request } from './api';

export interface Resource<T> { data?: T; error?: Error; loading: boolean; reload: () => void }
export function useResource<T>(path: string | null, options?: { autoRefresh?: boolean }): Resource<T> {
  const [state, setState] = useState<{ path: string | null; data?: T; error?: Error; loading: boolean }>({ path, loading: !!path });
  const inFlight = useRef<{ path: string; controller: AbortController } | null>(null);
  const pathRef = useRef(path);
  pathRef.current = path;

  const fetchResource = useCallback((fetchPath: string, isRefresh: boolean, onComplete?: () => void) => {
    if (inFlight.current?.path === fetchPath) {
      if (onComplete) onComplete();
      return; // No overlapping requests
    }
    if (inFlight.current) {
      inFlight.current.controller.abort();
    }
    const controller = new AbortController();
    inFlight.current = { path: fetchPath, controller };

    setState(s => s.path === fetchPath ? { ...s, loading: true } : { path: fetchPath, loading: true });

    request<T>(fetchPath, { signal: controller.signal })
      .then(data => {
        if (!controller.signal.aborted) {
          inFlight.current = null;
          setState({ path: fetchPath, data, loading: false });
        }
        if (onComplete) onComplete();
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          inFlight.current = null;
          setState(s => s.path === fetchPath
            ? { ...s, error: error instanceof Error ? error : new ApiError(0, 'unknown', 'Request failed.'), loading: false, data: isRefresh ? s.data : undefined }
            : { path: fetchPath, error: error instanceof Error ? error : new ApiError(0, 'unknown', 'Request failed.'), loading: false }
          );
        }
        if (onComplete) onComplete();
      });
  }, []);

  useEffect(() => {
    if (!path) {
      if (inFlight.current) { inFlight.current.controller.abort(); inFlight.current = null; }
      setState({ path, loading: false });
      return;
    }
    fetchResource(path, false);
    return () => {
      if (inFlight.current?.path === path) {
        inFlight.current.controller.abort();
        inFlight.current = null;
      }
    };
  }, [path, fetchResource]);

  useEffect(() => {
    if (!options?.autoRefresh || !path) return;
    let timer: number;
    let isActive = true;

    const schedule = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (!isActive) return;
        if (document.visibilityState === 'visible') {
          if (pathRef.current === path) {
             fetchResource(path, true, schedule);
          } else {
             schedule();
          }
        } else {
          schedule();
        }
      }, 30000);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        window.clearTimeout(timer);
        if (pathRef.current === path) {
           fetchResource(path, true, schedule);
        } else {
           schedule();
        }
      }
    };

    schedule();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isActive = false;
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [path, options?.autoRefresh, fetchResource]);

  const reload = useCallback(() => {
    if (pathRef.current) fetchResource(pathRef.current, true);
  }, [fetchResource]);
  return { ...(state.path === path ? state : { loading: !!path }), reload };
}
export function useFilters() {
  const [params, setParams] = useSearchParams();
  const location = useLocation();
  const set = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value); else next.delete(key);
    if (key !== 'cursor' && key !== 'flow' && key !== 'rule' && key !== 'tab') next.delete('cursor');
    if (key === 'range') { next.delete('from'); next.delete('to'); }
    if (value && key === 'flow') next.delete('rule');
    if (value && key === 'rule') next.delete('flow');
    if (demoEnabled) next.set('demo', '1');
    setParams(next);
  };
  const clear = () => { const next = new URLSearchParams(); if (demoEnabled) next.set('demo', '1'); for (const key of ['range', 'demo_role']) if (params.has(key)) next.set(key, params.get(key)!); setParams(next); };
  const href = (path: string, extra: Record<string, string> = {}) => {
    const next = new URLSearchParams();
    for (const key of ['demo', 'demo_role', 'range', 'from', 'to']) { const value = params.get(key); if (value) next.set(key, value); }
    if (demoEnabled) next.set('demo', '1');
    for (const [key, value] of Object.entries(extra)) if (value) next.set(key, value);
    return `${path}${next.size ? `?${next}` : ''}`;
  };
  return { params, set, clear, href, location };
}
export function useRouteFocus() {
  const location = useLocation();
  const previous = useRef(location.pathname);
  useEffect(() => {
    const changed = previous.current !== location.pathname;
    previous.current = location.pathname;
    const orient = () => {
      const heading = document.querySelector<HTMLElement>('main h1');
      if (!heading) return false;
      document.title = `${heading.textContent || 'Observations'} · Lanrith console`;
      if (changed) { heading.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      return true;
    };
    if (orient()) return;
    document.title = 'Loading observations · Lanrith console';
    // Device headings arrive with the request. Orient once their content is ready.
    const observer = new MutationObserver(() => { if (orient()) observer.disconnect(); });
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);
}
