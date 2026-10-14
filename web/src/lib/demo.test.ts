import { describe, expect, it } from 'vitest';
import { createDemo } from './demo';
import type { DeviceDetail } from '../types';
describe('explicit demo contract', () => {
  it('denies Viewer traffic/export/annotations and restricts device detail', async () => {
    const demo = createDemo('viewer');
    for (const path of ['/flows', '/export?kind=flows']) await expect(demo(path)).rejects.toMatchObject({ status: 403 });
    const detail = await demo('/devices/device-a') as DeviceDetail;
    expect(detail.detail_restricted).toBe(true); expect(detail.flows).toEqual([]);
    await expect(demo('/devices/device-a/annotation', { method: 'POST', headers: { 'X-CSRF-Token': 'explicit-demo-csrf' }, body: '{}' })).rejects.toMatchObject({ status: 403 });
  });
  it('stores only authorized CSRF-protected console annotations', async () => {
    const demo = createDemo();
    await expect(demo('/devices/device-a/annotation', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'csrf' });
    await demo('/devices/device-a/annotation', { method: 'POST', headers: { 'X-CSRF-Token': 'explicit-demo-csrf' }, body: '{"alias":"Local alias","note":"A note"}' });
    expect((await demo('/devices/device-a') as DeviceDetail).annotation?.alias).toBe('Local alias');
  });
  it('honors device/search filters and reports unknown endpoints', async () => {
    const demo = createDemo();
    expect(await demo('/devices?q=sensor')).toMatchObject({ items: [expect.objectContaining({ id: 'device-b' })] });
    // Phase 3 /flows attaches evidence sources beside the bounded page.
    expect(await demo('/flows?device_id=device-b')).toMatchObject({ items: [] });
    await expect(demo('/unsupported')).rejects.toMatchObject({ status: 404 });
  });
});
