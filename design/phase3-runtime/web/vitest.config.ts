import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/** CI scheduling bound (phase3-release-ci-failure.log, 2026-10-14):
 * the release runner ran too many jsdom files concurrently and the two
 * 300/650-rule pagination interaction tests exceeded their 5000 ms gates
 * (5191/5176 ms) purely from CPU contention. maxWorkers 2 still contended
 * on a 2-core constraint (rule-501 at 5155 ms), so the suite runs on a
 * single worker — the heaviest file gets the machine to itself. Assertions,
 * data sizes, timeout gates and per-file isolation are unchanged. */
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    restoreMocks: true,
    maxWorkers: 1,
    isolate: true, // per-file isolation (default, stated explicitly)
  },
});
