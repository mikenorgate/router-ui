// Handoff-only type shim. web/src/lib/api.ts reads import.meta.env.VITE_DEMO_MODE;
// web/tsconfig.json already supplies vite/client types, so delete this file when the
// src/ tree is copied into web/src. It exists so the standalone handoff tsconfig can
// type-check without depending on vite package resolution.
interface ImportMetaEnv {
  readonly VITE_DEMO_MODE?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
