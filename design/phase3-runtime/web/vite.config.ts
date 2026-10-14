import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** src/styles.css carries the exact production imports from web/src
 * ('../../design/…'). Installed at the repository root those resolve
 * directly; from design/phase3-runtime/web they would miss, so this build-time
 * normalization rewrites them to the same canonical design/ files before the
 * CSS pipeline resolves @import. The overlay sources therefore stay
 * byte-identical to a production install and no path edit is required when
 * copying src/ into web/. */
function normalizeDesignCssPaths(): Plugin {
  return {
    name: 'normalize-design-css-paths',
    enforce: 'pre',
    transform(code, id) {
      if (!id.endsWith('src/styles.css')) return null;
      return code.replaceAll("'../../design/", "'../../../design/");
    },
  };
}

export default defineConfig({
  plugins: [normalizeDesignCssPaths(), react()],
  base: '/',
  server: { proxy: { '/api': 'http://127.0.0.1:8080', '/auth': 'http://127.0.0.1:8080' } },
  build: { assetsInlineLimit: 0, sourcemap: false },
});
