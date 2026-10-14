// Open Design dev-server shim.
//
// The Open Design daemon detects a framework config at the imported project
// root and spawns `vite --port <n>` with this directory as cwd. The Router
// Console app lives in web/, so this file only delegates to that config and
// points Vite's root at it. The daemon resolves the `vite` binary through the
// PATH prepend in .env.local (loaded by the daemon, not by Vite).
import { fileURLToPath } from 'node:url';
import webConfig from './web/vite.config';

export default {
  ...webConfig,
  root: fileURLToPath(new URL('./web', import.meta.url)),
};
