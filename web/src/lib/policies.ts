import { useEffect, useMemo, useRef, useState } from 'react';
import type { Collection, Policy, Source } from '../types';
import { query, request } from './api';
import type { Resource } from './hooks';

/** Page size for policy queries. The backend accepts limit 1–500; 100 matches its default. */
export const POLICY_PAGE_LIMIT = 100;
/** The backend accepts offsets up to this bound and serves one final page there, withholding next_cursor beyond it. */
export const POLICY_WINDOW_CAP = 10000;

export interface PolicyParams { deviceId?: string; q?: string; evidence?: string }

export { producerUnknown, producerLabel } from './policyOrigin';

/** Canonical policies query path. Parameter order is stable so tests and logs stay readable. */
export function policiesPath(params: PolicyParams, cursor?: string | null): string {
  return query('/policies', {
    device_id: params.deviceId || undefined,
    q: params.q || undefined,
    evidence: params.evidence || undefined,
    limit: String(POLICY_PAGE_LIMIT),
    cursor: cursor || undefined,
  });
}

/** A full page without a next cursor means the bounded query window was reached, not the end of records. */
export function windowCapped(collection: Collection<Policy>): boolean {
  return !collection.next_cursor && (collection.items?.length ?? 0) >= POLICY_PAGE_LIMIT;
}

export interface PolicyPagesError { error: Error; retry: 'more' | 'reconcile' }
export interface PolicyPagesState {
  resource: Resource<Collection<Policy>>;
  policies: Policy[];
  sources?: Source[];
  nextCursor: string | null;
  atCap: boolean;
  loadedPages: number;
  loadingMore: boolean;
  reconciling: boolean;
  pagesError: PolicyPagesError | null;
  loadMore: () => void;
  reload: () => void;
}

interface Extras {
  key: string;
  items: Policy[];
  cursor: string | null;
  atCap: boolean;
  loadedPages: number;
  error: PolicyPagesError | null;
}
const emptyExtras = (key: string): Extras => ({ key, items: [], cursor: null, atCap: false, loadedPages: 0, error: null });

function asError(error: unknown): Error {
  return error instanceof Error ? error : new Error('Request failed.');
}
function isAbort(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Explicit, bounded pagination over the policies collection on top of a first-page resource.
 * Loaded pages are deduped by rule id, refetched in order when the first page refreshes
 * (non-overlapping and cancelable), and retained as stale evidence when a refetch fails.
 */
export function usePolicyPages(resource: Resource<Collection<Policy>>, params: PolicyParams): PolicyPagesState {
  const key = policiesPath(params);
  const [extrasState, setExtrasState] = useState<Extras>(() => emptyExtras(key));
  if (extrasState.key !== key) {
    // Query changed: reset the loaded pages during render so the old key neither retains
    // rows nor blocks commits under the new query. React re-renders before committing.
    setExtrasState(emptyExtras(key));
  }
  const extras = extrasState.key === key ? extrasState : emptyExtras(key);
  const [busy, setBusy] = useState<'more' | 'reconcile' | null>(null);
  const opRef = useRef<{ key: string; controller: AbortController } | null>(null);
  const paramsRef = useRef(params);
  paramsRef.current = params;
  const extrasRef = useRef(extras);
  extrasRef.current = extras;
  const lastDataRef = useRef<Collection<Policy> | undefined>(undefined);

  // Cancel in-flight page work when the query changes or the component unmounts.
  useEffect(() => {
    return () => {
      if (opRef.current) { opRef.current.controller.abort(); opRef.current = null; }
      setBusy(null);
    };
  }, [key]);

  const startOp = () => {
    if (opRef.current) opRef.current.controller.abort(); // Non-overlapping: supersede any running page operation.
    const controller = new AbortController();
    opRef.current = { key, controller };
    return controller;
  };
  const endOp = (controller: AbortController) => {
    if (!controller.signal.aborted && opRef.current?.controller === controller) {
      opRef.current = null;
      setBusy(null);
    }
  };

  const loadMore = () => {
    const first = resource.data;
    const current = extrasRef.current;
    if (!first || busy || current.key !== key || current.atCap) return;
    const cursor = current.loadedPages > 0 ? current.cursor : first.next_cursor || null;
    if (!cursor) return;
    const controller = startOp();
    setBusy('more');
    request<Collection<Policy>>(policiesPath(paramsRef.current, cursor), { signal: controller.signal })
      .then(res => {
        if (controller.signal.aborted) return;
        setExtrasState(prev => {
          if (prev.key !== key) return prev;
          const seen = new Set(prev.items.map(p => p.id));
          const novel = (res.items || []).filter(p => !seen.has(p.id));
          return { key, items: [...prev.items, ...novel], cursor: res.next_cursor || null, atCap: windowCapped(res), loadedPages: prev.loadedPages + 1, error: null };
        });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbort(error)) return;
        setExtrasState(prev => prev.key === key ? { ...prev, error: { error: asError(error), retry: 'more' } } : prev);
      })
      .finally(() => endOp(controller));
  };

  // Reconciliation: a refreshed first page invalidates the cursor chain of every loaded page.
  // Refetch them sequentially with the current filters; on failure keep the stale page set visible.
  useEffect(() => {
    const data = resource.data;
    if (!data) { lastDataRef.current = undefined; return; }
    if (lastDataRef.current === data) return;
    const hadPrevious = lastDataRef.current !== undefined;
    lastDataRef.current = data;
    const loaded = extrasRef.current;
    if (!hadPrevious || loaded.key !== key || loaded.loadedPages === 0) return;
    const controller = startOp();
    setBusy('reconcile');
    const pagesToRefetch = loaded.loadedPages;
    (async () => {
      try {
        let cursor = data.next_cursor || null;
        let atCap = windowCapped(data);
        const items: Policy[] = [];
        let fetched = 0;
        while (fetched < pagesToRefetch && cursor && !atCap) {
          const res = await request<Collection<Policy>>(policiesPath(paramsRef.current, cursor), { signal: controller.signal });
          if (controller.signal.aborted) return;
          const seen = new Set(items.map(p => p.id));
          items.push(...(res.items || []).filter(p => !seen.has(p.id)));
          cursor = res.next_cursor || null;
          atCap = windowCapped(res);
          fetched++;
        }
        if (controller.signal.aborted) return;
        setExtrasState(prev => prev.key === key ? { key, items, cursor, atCap, loadedPages: fetched, error: null } : prev);
      } catch (error) {
        if (controller.signal.aborted || isAbort(error)) return;
        setExtrasState(prev => prev.key === key ? { ...prev, error: { error: asError(error), retry: 'reconcile' } } : prev);
      } finally {
        endOp(controller);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resource.data, key]);

  const policies = useMemo(() => {
    const out: Policy[] = [];
    const seen = new Set<string>();
    for (const policy of [...(resource.data?.items || []), ...extras.items]) {
      if (seen.has(policy.id)) continue;
      seen.add(policy.id);
      out.push(policy);
    }
    return out;
  }, [resource.data, extras]);

  const nextCursor = extras.loadedPages > 0 ? extras.cursor : resource.data?.next_cursor || null;
  const atCap = extras.loadedPages > 0 ? extras.atCap : resource.data ? windowCapped(resource.data) : false;

  return {
    resource,
    policies,
    sources: resource.data?.sources,
    nextCursor,
    atCap,
    loadedPages: extras.loadedPages,
    loadingMore: busy === 'more',
    reconciling: busy === 'reconcile',
    pagesError: extras.error,
    loadMore,
    reload: resource.reload,
  };
}
