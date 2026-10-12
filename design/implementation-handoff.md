# Implementation handoff

Read `README.md`, `DESIGN.md`, `tokens.css`, `components.manifest.json`, `docs/DESIGN_BRIEF.md` and `docs/PRODUCT_PLAN.md`. Use Storybook (`pnpm storybook`) for component design reference; each TypeScript component has a colocated story. Native browser reference: `components.html` → `ui_kits/app/index.html`.

Load `colors_and_type.css` before `build/reference.css`. Reuse semantic tokens; do not add palette values in components. Keep local fonts and their OFL licences; generated browser bundles live in `ui_kits/app/components/*.js`. Rebuild with `pnpm build:reference` after source edits. No external runtime requests.

Compose small device, metric, table, chart, policy and access modules. Maintain all three policy evidence states, source producer, inherited scope, version, expiry and observation time. Unknown origin, no observations, stale snapshots, permission-limited fields and sampled gaps are first-class states. Shared counters and simulations remain labelled.

First application artifact should prove device → flow → rule provenance in both themes, mobile and 200% zoom. Preserve 44px controls, visible keyboard focus, arrow-key tabs, Escape/focus restoration and chart data alternatives. Bind a real policy API only in the separate application repository; this draft stays read-only and local.

Run `pnpm typecheck`, `pnpm build:reference`, `pnpm validate`, then `"$OD_NODE_BIN" "$OD_BIN" tools connectors design-system-package-audit --path . --fail-on-warnings`. Review this draft before adopting it; do not publish it or create another identity.
