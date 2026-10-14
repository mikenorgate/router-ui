# Implementation handoff

Read `README.md`, `DESIGN.md`, `tokens.css`, `components.manifest.json`, `docs/DESIGN_BRIEF.md` and `docs/PRODUCT_PLAN.md`. Use Storybook (`pnpm storybook`) for component design reference; each TypeScript component has a colocated story. Native browser reference: `components.html` → `ui_kits/app/index.html`.

Load `colors_and_type.css` before `build/reference.css`. Reuse semantic tokens; do not add palette values in components. Use Brand.ts and its paired story for exact outlined wordmarks/marks in both themes. Keep local Manrope (200–800) and Plex Mono with their separate OFL licences; legacy Plex Sans is unused and retains OFL-plex-sans.txt. Body text is 16px; compact headings and metadata are unchanged. generated browser bundles live in `ui_kits/app/components/*.js`. Rebuild structured tokens and browser output with `pnpm build:reference`, then `pnpm build:storybook`. No external runtime requests.

Use the current neutral dark roles: charcoal #171B1E, panel #20262A and raised #2A3236; grey metadata, borders, unknown states and chart fills. Keep Mint/Teal on active selection, primary controls, focus and chart lines. Preserve the canonical inset navigation indicator, exact reverse wordmark and reduced-motion correction in `colors_and_type.css`. The user's latest refinement is recorded in `context/provenance.md`; original brand/source files and Paper light mode remain unchanged.

Compose small device, metric, table, chart, policy and access modules. Maintain all three policy evidence states, source producer, inherited scope, version, expiry and observation time. Unknown origin, no observations, stale snapshots, permission-limited fields and sampled gaps are first-class states. Shared counters and simulations remain labelled.

First application artifact should prove device → flow → rule provenance in both themes, mobile and 200% zoom. Preserve 44px controls, visible keyboard focus, arrow-key tabs, Escape/focus restoration and chart data alternatives. Bind a real policy API only in the separate application repository; this draft stays read-only and local.

Run `pnpm typecheck`, `pnpm build:reference`, `pnpm validate`, then `"$OD_NODE_BIN" "$OD_BIN" tools connectors design-system-package-audit --path . --fail-on-warnings`. Brand copy comes from `context/lanrith-brand/copy/brand-copy.txt`: “Your homelab’s first hop.” and “A homelab router with the hard parts already figured out.” Review this draft before adopting it; do not publish it or create another identity.
