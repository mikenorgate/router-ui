import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router-dom';
import { ApiError, demoEnabled, request } from './api';

export interface Resource<T> { data?: T; error?: Error; loading: boolean; reload: () => void }
export function useResource<T>(path: string | null): Resource<T> {
  const [generation, setGeneration] = useState(0);
  const [state, setState] = useState<{ path: string | null; data?: T; error?: Error; loading: boolean }>({ path, loading: !!path });
  useEffect(() => {
    if (!path) { setState({ path, loading: false }); return; }
    const controller = new AbortController();
    setState({ path, loading: true });
    request<T>(path, { signal: controller.signal }).then(data => { if (!controller.signal.aborted) setState({ path, data, loading: false }); }).catch((error: unknown) => { if (!controller.signal.aborted) setState({ path, error: error instanceof Error ? error : new ApiError(0, 'unknown', 'Request failed.'), loading: false }); });
    return () => controller.abort();
  }, [path, generation]);
  const reload = useCallback(() => setGeneration(g => g + 1), []);
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
      document.title = `${heading.textContent || 'Router Console'} · Router Console`;
      if (changed) { heading.focus(); window.scrollTo({ top: 0, behavior: 'instant' }); }
      return true;
    };
    if (orient()) return;
    document.title = 'Loading observations · Router Console';
    // Device headings arrive with the request. Orient once their content is ready.
    const observer = new MutationObserver(() => { if (orient()) observer.disconnect(); });
    const main = document.querySelector('main');
    if (main) observer.observe(main, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [location.pathname]);
}
