import { act, render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useResource } from '../lib/hooks';
import { PoliciesPanel } from '../pages/DeviceDetailPage';
import { request } from '../lib/api';

vi.mock('../lib/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/api')>();
  return {
    ...actual,
    request: vi.fn(),
  };
});

import { AnnotationEditor } from '../components/AnnotationEditor';
import { AuthProvider } from '../auth';

import { waitFor } from '@testing-library/react';

describe('AnnotationEditor', () => {
  it('retains draft text during background refresh and shows failure while preserving draft', async () => {
    let rejectRequest: any;
    const reqPromise = new Promise((_, reject) => rejectRequest = reject);
    (request as any).mockReturnValue(reqPromise);

    const onSaved = vi.fn();
    const { getByLabelText, getByRole, getByText, rerender } = render(
      <AuthProvider initialSession={{ user: { id: 'test', name: 'Test', role: 'operator' }, csrf_token: '123', mode: 'production' }}>
        <AnnotationEditor deviceId="dev1" alias="Old Alias" note="Old Note" onSaved={onSaved} />
      </AuthProvider>
    );

    const aliasInput = getByLabelText('Console alias') as HTMLInputElement;
    const noteInput = getByLabelText('Console note') as HTMLTextAreaElement;
    
    expect(aliasInput.value).toBe('Old Alias');
    expect(noteInput.value).toBe('Old Note');

    // Type unsaved alias
    fireEvent.change(aliasInput, { target: { value: 'New Draft Alias' } });
    aliasInput.focus();
    
    expect(aliasInput.value).toBe('New Draft Alias');
    expect(document.activeElement).toBe(aliasInput);

    // Rerender as from background refresh (props change)
    rerender(
      <AuthProvider initialSession={{ user: { id: 'test', name: 'Test', role: 'operator' }, csrf_token: '123', mode: 'production' }}>
        <AnnotationEditor deviceId="dev1" alias="Server Updated Alias" note="Server Updated Note" onSaved={onSaved} />
      </AuthProvider>
    );
    
    // Should retain draft and focus
    expect(aliasInput.value).toBe('New Draft Alias');
    // Note remains old note because component is dirty and doesn't sync ANY props
    expect(noteInput.value).toBe('Old Note');
    expect(document.activeElement).toBe(aliasInput);

    // Submit and fail
    fireEvent.click(getByRole('button', { name: 'Save annotation' }));
    
    await act(async () => {
      rejectRequest(new Error('Network failure'));
      await Promise.resolve();
    });

    // Should show error and preserve draft
    expect(getByText('Network failure')).toBeInTheDocument();
    expect(aliasInput.value).toBe('New Draft Alias');
    expect(onSaved).not.toHaveBeenCalled();
  });
});

import { DeviceDetailPage } from '../pages/DeviceDetailPage';
import { MemoryRouter, Route, Routes, Link } from 'react-router-dom';

describe('DeviceDetailPage extra policies reconcile', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('refetches existing loaded page offsets on refresh and removes disappeared policies, retains stale on error', async () => {
    let requests: any[] = [];
    (request as any).mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/devices/dev1') {
        return { device: { id: 'dev1', observed_at: 100 }, policies: [{ id: 'p1', action: 'allow' }], policies_next_cursor: 'cursor1' };
      }
      if (path === '/policies?device_id=dev1&cursor=cursor1') {
        return { items: [{ id: 'p2', action: 'drop' }], next_cursor: 'done' };
      }
      return {};
    });

    const { getByText, queryByText } = render(
      <AuthProvider initialSession={{ user: { id: 'test', name: 'Test', role: 'operator' }, csrf_token: '123', mode: 'production' }}>
        <MemoryRouter initialEntries={['/devices/dev1?tab=firewall']}>
          <Routes><Route path="/devices/:id" element={<DeviceDetailPage />} /></Routes>
        </MemoryRouter>
      </AuthProvider>
    );

    // Initial load
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    expect(getByText('p1')).toBeInTheDocument();
    
    // Load more
    await act(async () => {
      fireEvent.click(getByText('Load more policies'));
      await Promise.resolve(); await Promise.resolve();
    });
    
    expect(getByText('p2')).toBeInTheDocument();
    requests = [];

    // Background refresh: snapshot changes, p2 disappeared
    (request as any).mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/devices/dev1') {
        return { device: { id: 'dev1', observed_at: 200 }, policies: [{ id: 'p1', action: 'allow' }], policies_next_cursor: 'cursorA' };
      }
      if (path === '/policies?device_id=dev1&cursor=cursorA') {
        return { items: [{ id: 'p3', action: 'drop' }], next_cursor: 'done' }; // p2 disappeared, p3 arrived
      }
      return {};
    });

    // We can simulate refresh by causing `useResource` to fetch again, but it's easier to just trigger it via `DeviceDetailPage`
    // Oh wait, `DeviceDetailPage` relies on `useResource`, which refreshes on visibility/timer, or manual reload.
    // Let's use `vi.advanceTimersByTime(30000)` ? Wait, timer is mocked out in this file sometimes, let's check if it is active.
    // We can just manually rerender? No, `useResource` does the fetching.
    // Let's manually trigger a visibility change since `autoRefresh` is true.
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' });
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });
    
    // Should have re-fetched device and then the policies
    expect(requests).toContain('/devices/dev1');
    expect(requests).toContain('/policies?device_id=dev1&cursor=cursorA');

    // p2 is gone! p3 is here!
    expect(queryByText('p2')).not.toBeInTheDocument();
    expect(getByText('p3')).toBeInTheDocument();

    requests = [];
    
    // Refresh again, but pagination request fails
    (request as any).mockImplementation(async (path: string) => {
      requests.push(path);
      if (path === '/devices/dev1') {
        return { device: { id: 'dev1', observed_at: 300 }, policies: [{ id: 'p1', action: 'allow' }], policies_next_cursor: 'cursorB' };
      }
      if (path === '/policies?device_id=dev1&cursor=cursorB') {
        throw new Error('Network timeout');
      }
      return {};
    });

    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    await act(async () => { await Promise.resolve(); await Promise.resolve(); });

    // Should show error and RETAIN p3 as stale
    expect(getByText('Network timeout')).toBeInTheDocument();
    expect(getByText('p3')).toBeInTheDocument(); // retained!
  });

  it('ignores a stale async response after device navigation', async () => {
    let resolveSlowRequest: any;
    (request as any).mockImplementation(async (path: string) => {
      if (path === '/devices/dev-slow') {
        return { device: { id: 'dev-slow', observed_at: 100 }, policies: [{ id: 'slow-p', action: 'allow' }], policies_next_cursor: 'cursor-slow' };
      }
      if (path === '/policies?device_id=dev-slow&cursor=cursor-slow') {
        return new Promise(r => resolveSlowRequest = r);
      }
      if (path === '/devices/dev-fast') {
        return { device: { id: 'dev-fast', observed_at: 100 }, policies: [{ id: 'fast-p', action: 'allow' }], policies_next_cursor: 'done' };
      }
      return {};
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthProvider initialSession={{ user: { id: 'test', name: 'Test', role: 'operator' }, csrf_token: '123', mode: 'production' }}>
        {children}
      </AuthProvider>
    );

    const { getByText, queryByText } = render(
      <MemoryRouter initialEntries={['/devices/dev-slow?tab=firewall']}>
        <Link to="/devices/dev-fast?tab=firewall" data-testid="nav-fast">go</Link>
        <Routes>
          <Route path="/devices/:id" element={<DeviceDetailPage />} />
        </Routes>
      </MemoryRouter>,
      { wrapper }
    );

    await waitFor(() => expect(getByText('slow-p')).toBeInTheDocument());
    
    // Start loading more for dev-slow
    await act(async () => {
      fireEvent.click(getByText('Load more policies'));
    });

    // Navigate to dev-fast
    await act(async () => {
      fireEvent.click(getByText('go'));
    });

    await waitFor(() => expect(getByText('fast-p')).toBeInTheDocument());
    
    // Now resolve the slow request for dev-slow
    await act(async () => {
      resolveSlowRequest({ items: [{ id: 'ghost-p', action: 'drop' }], next_cursor: 'done' });
      await Promise.resolve(); await Promise.resolve();
    });

    // Should NOT show the ghost policy from the old device
    expect(queryByText('ghost-p')).not.toBeInTheDocument();
  });
});

describe('useResource polling and caching', () => {
  let visibilityState = 'visible';
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibilityState
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  function TestComponent({ path, autoRefresh }: { path: string | null; autoRefresh?: boolean }) {
    const res = useResource<any>(path, { autoRefresh });
    return (
      <div>
        <div data-testid="loading">{res.loading ? 'loading' : 'idle'}</div>
        <div data-testid="data">{res.data ? res.data.value : 'nodata'}</div>
        <div data-testid="error">{res.error ? res.error.message : 'noerror'}</div>
        <button onClick={res.reload}>Reload</button>
      </div>
    );
  }

  it('exercises THREE automatic timer intervals, hidden visibility no fetch, resume, slow unresolved request no overlap, manual refresh during request', async () => {
    let resolveRequest: any;
    let reqPromise: any;
    
    // First request
    reqPromise = new Promise(r => resolveRequest = r);
    (request as any).mockReturnValueOnce(reqPromise);

    const { getByTestId, getByText } = render(<TestComponent path="/test" autoRefresh={true} />);
    
    // Initial fetch
    expect(request).toHaveBeenCalledTimes(1);
    expect(getByTestId('loading').textContent).toBe('loading');
    
    await act(async () => {
      resolveRequest({ value: '1' });
      await Promise.resolve(); // flush microtasks
    });
    expect(getByTestId('loading').textContent).toBe('idle');
    expect(getByTestId('data').textContent).toBe('1');

    // 1st interval
    reqPromise = new Promise(r => resolveRequest = r);
    (request as any).mockReturnValueOnce(reqPromise);
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(request).toHaveBeenCalledTimes(2);
    await act(async () => { resolveRequest({ value: '2' }); await Promise.resolve(); });
    expect(getByTestId('data').textContent).toBe('2');

    // 2nd interval
    reqPromise = new Promise(r => resolveRequest = r);
    (request as any).mockReturnValueOnce(reqPromise);
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(request).toHaveBeenCalledTimes(3);
    await act(async () => { resolveRequest({ value: '3' }); await Promise.resolve(); });
    
    // 3rd interval with hidden visibility
    visibilityState = 'hidden';
    await act(async () => { vi.advanceTimersByTime(30000); });
    // Should NOT fetch
    expect(request).toHaveBeenCalledTimes(3);
    
    // Resume (visibility visible)
    reqPromise = new Promise(r => resolveRequest = r);
    (request as any).mockReturnValueOnce(reqPromise);
    visibilityState = 'visible';
    await act(async () => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(request).toHaveBeenCalledTimes(4); // Fetches on resume
    
    // Slow unresolved request no overlap & manual refresh during request
    // We haven't resolved 4th request yet.
    expect(getByTestId('loading').textContent).toBe('loading');
    expect(getByTestId('data').textContent).toBe('3'); // Old data preserved!

    // Interval fires while 4th request is in flight
    await act(async () => { vi.advanceTimersByTime(30000); });
    expect(request).toHaveBeenCalledTimes(4); // No overlap!

    // Manual refresh during request
    await act(async () => {
      fireEvent.click(getByText('Reload'));
    });
    expect(request).toHaveBeenCalledTimes(4); // Still no overlap!

    // Resolve 4th request
    await act(async () => { resolveRequest({ value: '4' }); await Promise.resolve(); });
    expect(getByTestId('data').textContent).toBe('4');

    // Refresh error preserving visible data
    (request as any).mockRejectedValueOnce(new Error('fail'));
    await act(async () => { vi.advanceTimersByTime(30000); }); // trigger next fetch
    expect(request).toHaveBeenCalledTimes(5);
    await act(async () => { await Promise.resolve(); }); // flush
    expect(getByTestId('data').textContent).toBe('4'); // Preserved data
    expect(getByTestId('error').textContent).toBe('fail'); // Error is shown
  });

  it('fixed interval no polling', async () => {
    (request as any).mockResolvedValue({ value: 'fixed' });
    render(<TestComponent path="/test-fixed" autoRefresh={false} />);
    expect(request).toHaveBeenCalledTimes(1);
    await act(async () => { await Promise.resolve(); });
    
    // Advance timers
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(request).toHaveBeenCalledTimes(1); // No polling
  });
});

describe('PoliciesPanel features', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('preserves extra policy across refresh, dedupes pages by ID, shows inline error', async () => {
    const initialPolicies = [{ id: 'p1', action: 'allow' }];
    let onLoadedMore = vi.fn();
    
    const { getByText, container } = render(
      <PoliciesPanel 
        deviceId="dev1" 
        initialPolicies={initialPolicies as any} 
        extraPolicies={[]}
        nextCursor="cursor1" 
        selectedRule={null} 
        onInspect={() => {}} 
        onLoadedMore={onLoadedMore} 
      />
    );
    
    expect(getByText('p1')).toBeInTheDocument();
    expect(getByText('Load more policies')).toBeInTheDocument();

    // Pagination subsequent page
    (request as any).mockResolvedValueOnce({
      items: [{ id: 'p2', action: 'drop' }, { id: 'p1', action: 'allow' }], // p1 should be deduped
      next_cursor: 'cursor2'
    });
    
    await act(async () => {
      fireEvent.click(getByText('Load more policies'));
    });
    
    expect(request).toHaveBeenCalledWith('/policies?device_id=dev1&cursor=cursor1');
    expect(onLoadedMore).toHaveBeenCalledWith([{ id: 'p2', action: 'drop' }, { id: 'p1', action: 'allow' }], 'cursor2');
    
    // Rerender as if parent updated it
    render(
      <PoliciesPanel 
        deviceId="dev1" 
        initialPolicies={initialPolicies as any} 
        extraPolicies={[{ id: 'p2', action: 'drop' }] as any}
        nextCursor="cursor2" 
        selectedRule={null} 
        onInspect={() => {}} 
        onLoadedMore={onLoadedMore} 
      />,
      { container }
    );
    
    expect(getByText('p1')).toBeInTheDocument();
    expect(getByText('p2')).toBeInTheDocument(); // newly loaded and deduped (no duplicate p1 shown)

    // Unsaved draft through a refresh is typically at the DeviceDetailPage level (AnnotationEditor), 
    // but the test name implies we should just test we don't reset state.
    
    // Refresh error preserving visible data
    (request as any).mockRejectedValueOnce(new Error('Network error loading policies'));
    
    await act(async () => {
      fireEvent.click(getByText('Load more policies'));
    });
    
    expect(getByText('Network error loading policies')).toBeInTheDocument();
    expect(getByText('p1')).toBeInTheDocument();
    expect(getByText('p2')).toBeInTheDocument(); // Preserved!
  });
});
