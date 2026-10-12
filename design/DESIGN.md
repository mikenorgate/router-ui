# Router Console Design System

> Category: Project Design System
> Surface: web
> Status: Draft for user review

## Product Context
Router Console is a standalone observatory for an immutable router. Its primary work is investigating measurements, devices, traffic and installed policy. This package defines reusable UI examples; it does not select an application framework, datapath, monitoring stack, inventory, controller or identity provider. Evidence: `context/source-context.md`, `docs/DESIGN_BRIEF.md`, `docs/PRODUCT_PLAN.md`. Numeric palette values and component dimensions below are design inferences from those supplied documents, not extracted brand facts.

## 1. Visual Theme & Atmosphere
A calm precise instrument panel: warm off-white and white in light mode, graphite and slate in dark mode, thin dividers, aligned numeric columns, compact labelled navigation. The original route-junction mark is a small geometric identifier. Operational content comes first. All sample records are fictional and visibly labelled. Installed policy, applicability and observed matches are separate evidence claims.

## 2. Color & Tokens
`tokens.css` is canonical. `colors_and_type.css` imports it and binds local fonts. The palette uses OKLCH to guarantee perceptual lightness and contrast. 

**Light Mode Core:**
- `--bg: oklch(0.975 0.005 95)` — Warm off-white page background.
- `--surface: oklch(0.995 0.002 95)` — Bright card and panel backgrounds.
- `--surface-raised: oklch(0.955 0.006 95)` — Elevated surfaces like dropdowns.
- `--fg: oklch(0.25 0.012 250)` — Primary text (targets 4.5:1 contrast).
- `--muted: oklch(0.49 0.013 245)` — Secondary text and metadata.
- `--border: oklch(0.85 0.010 245)` — Non-essential layout dividers.
- `--control-border: oklch(0.57 0.012 245)` — Inputs and outline buttons (targets 3:1).
- `--accent: oklch(0.42 0.075 185)` — Selection and primary action.
- `--on-accent: oklch(0.99 0.002 185)` — Text on primary buttons.

**Dark Mode Core:** Background `L .205`, surface `L .245`, foreground `L .925`, muted `L .73`, border `L .365`, control border `L .60`, action accent `oklch(0.78 0.090 185)`. Dark mode shifts to graphite and slate tones.

**Semantic States & Charts:**
- **Success:** `--success` / `--success-soft` (Green) for operational success/allow.
- **Warning:** `--warn` / `--warn-soft` (Amber) for stale/partial evidence.
- **Danger:** `--danger` / `--danger-soft` (Red) for observed denial/error.
- **Unknown:** `--unknown` / `--unknown-soft` (Neutral) for unobserved claims.
- **Charts:** `--chart-primary`, `--chart-secondary`, `--chart-fill` for neutral distinct solid/dashed series and filled areas.

Every state includes a word and symbol. Unknown/unobserved uses neutral text and a question mark or hollow circle. Policy lifecycle does not imply traffic success. Accent is limited to selection and one main action per composition. Focus uses `--accent` with a 2px outline and 3px offset.

## 3. Typography
Local **IBM Plex Sans** (400/500/600) for headings, labels, and body.
Local **IBM Plex Mono** (400/500) for addresses, rule identifiers, timestamps, values, and units.
`fonts/` includes SIL OFL licences. Fallbacks: Segoe UI/system sans and SFMono-Regular/Consolas/monospace. Latin font subset; other scripts use system fallback. 

**Role Sizes:**
- `--text-xs` (0.75rem / 12px) — Metadata, small badges.
- `--text-sm` (0.8125rem / 13px) — Secondary labels.
- `--text-body` (0.9375rem / 15px) — Primary body content.
- `--text-label` (0.875rem / 14px) — Table headings, controls.
- `--text-section` (1.125rem / 18px) — Section headers.
- `--text-title` (1.625rem / 26px) — Page titles.
- `--text-metric` (1.875rem / 30px) — Large numeric values.

Headings stay compact; there is no display hero. Body leading (`--leading-body: 1.5`), numeric figures tabular, all-caps metadata tracked .08em. Do not use bold for every cell. Address strings wrap safely at small widths.

## 4. Spacing & Grid
The system uses a 4px base scale: `--space-1` (4px), `--space-2` (8px), `--space-3` (12px), `--space-4` (16px), `--space-5` (24px), `--space-6` (32px), `--space-7` (48px).

- **Controls:** Height `--control-height` (44px).
- **Rows:** Table rows `--row-height` (52px), optional compact rows (44px) via `[data-density="compact"]`.
- **Radii:** `--radius-sm` (4px) for badges, `--radius-md` (6px) for controls, `--radius-lg` (8px) for panels.
- **Layout:** Sidebar width `--sidebar-width` (208px). Main content uses a minimum-zero grid with a maximum `--content-max` (1480px) width. 

Broad chart lanes share their plot margins and time axis. Essential form boundaries are stronger than layout dividers. Tables are grouped with rules, not individually boxed rows.

## 5. Layout & Composition
Desktop: compact labelled sidebar, breadcrumb, title, global search and shared interval selector. Seven product sections: Overview, Devices, Traffic, Network, Firewall, Events, System. Only representative examples are implemented in this package; unsupported navigation is labelled rather than implying full modules. On narrow screens the navigation becomes a disclosure, metrics stack, two-column detail layouts become one, and tables become labelled records preserving fields. At 200% zoom layout reflows; no page-level horizontal scroll. An inspector has a clear heading, close control and return path; long investigations get their own example page. Missing samples break chart paths and have a textual equivalent.

## 6. Components
Reuse the TypeScript components and their Storybook stories under `ui_kits/app/components/`; the compiled reference runtime is local. See `components.manifest.json` for specimens and contracts.

- **Badge:** Text plus symbol for installed, applicable, observed match, stale, unknown, expired, unsupported, and permission-limited evidence. Includes soft background and solid text.
- **Sidebar:** Labelled navigation, active parent, original mark, mobile disclosure. Uses `--bg` or `--surface`.
- **Metric:** Value, unit, change, observation age, and evidence qualifier. Shared totals never become device-specific counts. Tabular numerals essential.
- **Chart:** Aligned time lanes, direct units, neutral solid/dashed series (`--chart-primary`, `--chart-secondary`), area fill (`--chart-fill`), event marker, selected interval, explicit missing-data band, sampled annotation, and accessible table alternative.
- **PolicyTable:** Bounded fictional rows, query/filter, sortable headings, selected row, empty state, and density options (`data-density`). An inspect control works without relying on row clicks. Uses `--row-height`.
- **Inspector:** Original/translated tuples, recorded hook path, provenance chain, and gaps. Source image/config/runtime producer, inherited scope, version, expiry, and observation time stay visible. Uses `--surface-raised` or `--shadow-overlay` for depth.
- **AuthPanel:** Generic configured OIDC provider, independent local recovery, provider unavailable, session expiry, access denied, and local validation. Credential submission is a labelled local example, never a live login.
- **App:** Composes roles into overview, device Firewall tab, flow inspector, access/error states, and component reference.

**Firewall concepts:** **Installed** means observed in a specific revision; **Applicable** means scope/conditions cover a device or tuple; **Observed match** requires attributed traffic evidence. Shared counters say "Shared rule counter"; unknown origin says "Origin unavailable". Expiry does not prove removal unless a later snapshot establishes it. Simulated policy outcomes are labelled and separate from observed verdicts and application connectivity.

## 7. Motion & Interaction
Default transition uses `--ease-out` (`cubic-bezier(0.23, 1, 0.32, 1)`), enter `--duration-enter` (200ms), exit `--duration-exit` (140ms). No decorative traffic animation. Reduced motion removes transitions. Use semantic buttons, native inputs/selects, visible focus, and a skip link. Modal inspection traps focus, closes on Escape, and restores the trigger. Tabs support arrows/Home/End. Tables have captions, sortable states, and labelled mobile values. Theme/density preferences may persist locally; credentials do not. Permission-denied exports explain which permission is missing.

## 8. Voice & Brand
Plain operational language, sentence case, exact units and observation timestamps. “No observations since 09:14”, “Origin unavailable”, “Shared rule counter”, “Identity provider unavailable”. Distinguish last success from current health. Label predictions, sampling and unknowns beside the value. Never imply signing into the console grants device firewall access. Correlated events do not establish cause. Documentation keeps source facts separate from inferred values.

## 9. Implementation Notes & Anti-patterns
- **Implementation Notes:** Ensure React/HTML components map directly to semantic CSS tokens. Components must be modular, accept semantic props (e.g., `status="warn"` maps to `--warn` tokens). All icons should be accessible with `aria-hidden` when decorative, and accompanied by screen-reader text when functional.
- **Anti-patterns:** No marketing hero, giant headings, decorative gauges, glowing status dots, gradient washes, traffic particles, emoji icons, excessive cards, or rounded cards with coloured left borders. No colour-only status. No invented per-device counters, physical switch topology, application identity from port alone, or universal health score. No one-click allow, rule editor, image activation, or service restart in this read-only system. No household identifiers, external runtime fonts/CDNs, hardcoded provider, backend framework choice, or remote deployment. Preserve the source documents and existing package identity.