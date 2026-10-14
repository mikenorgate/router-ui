import { act, render, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useResource } from '../lib/hooks';
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
