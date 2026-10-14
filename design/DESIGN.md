# Lanrith Console Design System

> Category: Project Design System
> Surface: web
> Status: Draft for user review

## Product Context
Lanrith Console is a standalone observatory for an immutable router and edge OS. Its primary work is investigating measurements, devices, traffic and installed policy. This package defines reusable UI examples; it does not select an application framework, datapath, monitoring stack, inventory, controller or identity provider. Evidence: `context/source-context.md`, `docs/DESIGN_BRIEF.md`, `docs/PRODUCT_PLAN.md`. Numeric palette values and component dimensions below reflect the approved Lanrith brand integration.

## 1. Visual Theme & Atmosphere
A calm precise instrument panel: warm Paper off-white and white in light mode, neutral charcoal and grey surfaces in dark mode, thin dividers, aligned numeric columns, compact labelled navigation. Mint and Teal remain restrained brand accents. The Lanrith junction mark serves as the core geometric identifier. Operational content comes first. All sample records are fictional and visibly labelled. Installed policy, applicability and observed matches are separate evidence claims.

## 2. Color & Tokens
`tokens.css` is canonical. `colors_and_type.css` imports it and binds local fonts. OKLCH expresses the approved Lanrith brand colours and their semantic derivatives. Contrast depends on the actual foreground/background pair; `context/contrast-report.json` records the measured WCAG ratios. 

**Light Mode Core:**
- `--bg: oklch(0.961 0.011 89.7)` — Paper (#F5F2EA) page background.
- `--surface: oklch(1.000 0.000 89.9)` — Bright card and panel backgrounds.
- `--surface-raised: oklch(0.985 0.005 89.9)` — Elevated surfaces like dropdowns.
- `--fg: oklch(0.278 0.029 188.4)` — Ink (#162D2B) primary text.
- `--muted: oklch(0.454 0.024 176.5)` — Secondary text and metadata.
- `--border: oklch(0.782 0.015 162.4)` — Non-essential layout dividers.
- `--control-border: oklch(0.571 0.027 173.1)` — Inputs and outline buttons.
- `--accent: oklch(0.466 0.080 184.4)` — Teal (#08685F) selection and primary action.
- `--accent-soft: oklch(0.868 0.046 173.9)` — Mint (#B5DED1) subtle accents.
- `--on-accent: oklch(1.000 0.000 89.9)` — Text on primary buttons.

**Dark Mode Core:** The user's latest UI-theme refinement replaces green surfaces with neutral charcoal and grey, retaining Paper foreground and the approved reverse wordmark. Canonical OKLCH values resolve to:
- `--bg` — #171B1E charcoal page background.
- `--surface` — #20262A grey panels.
- `--surface-raised` — #2A3236 elevated grey surfaces.
- `--muted` / `--unknown` / `--chart-secondary` — #B9C0C5 grey metadata, unknown labels and secondary chart lines.
- `--border` — #495258 decorative grey dividers; `--control-border` — #879399 control boundaries.
- `--accent-soft` — #20262A neutral backing; `--unknown-soft` — #394247 missing-data backing; `--chart-fill` — #414B52 grey filled areas.

Mint remains on active selection, primary controls, focus and primary chart lines. The active navigation keeps its canonical inset accent indicator. Large fills stay neutral. This is a UI-theme refinement of the supplied brand kit; original brand tokens and assets remain preserved in `context/lanrith-brand/`.

**Semantic States & Charts:**
- **Success:** `--success` / `--success-soft` (Green / Mist #DDE5DF) for operational success/allow.
- **Warning:** `--warn` / `--warn-soft` (Amber) for stale/partial evidence.
- **Danger:** `--danger` / `--danger-soft` (Red) for observed denial/error.
- **Unknown:** `--unknown` / `--unknown-soft` (Neutral) for unobserved claims.
- **Charts:** `--chart-primary`, `--chart-secondary`, `--chart-fill` for neutral distinct solid/dashed series and filled areas.

Dark evidence badges use neutral `--surface` beneath labelled success, warning, danger and unknown text; their saturated soft tokens are not text backgrounds. Essential dark outlines and chart markers use grey `--muted`. `context/contrast-report.json` verifies these pairs against the current canonical theme.

Every state includes a word and symbol. Unknown/unobserved uses neutral text and a question mark or hollow circle. Policy lifecycle does not imply traffic success. Accent is limited to selection and one main action per composition. Focus uses `--accent` with a 2px outline and 3px offset.

## 3. Typography
Local variable **Manrope** (200–800 available; 400/500/600 used) for headings, labels, and body.
Local **IBM Plex Mono** (400/500) for addresses, rule identifiers, timestamps, values, and units.
`fonts/` includes SIL OFL licences. Fallbacks: Segoe UI/system sans and SFMono-Regular/Consolas/monospace. Latin font subset; other scripts use system fallback. 

**Role Sizes:**
- `--text-xs` (0.75rem / 12px) — Metadata, small badges.
- `--text-sm` (0.8125rem / 13px) — Secondary labels.
- `--text-body` (1rem / 16px) — Primary body content.
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

- **Brand:** Exact approved full outlined wordmark and standalone junction mark, using primary assets in light mode and reverse assets in dark mode. Never retype the wordmark or alter its geometry. Each lockup has one accessible name.
- **Badge:** Text plus symbol for installed, applicable, observed match, stale, unknown, expired, unsupported, and permission-limited evidence. Includes soft background and solid text.
- **Sidebar:** Labelled navigation, active parent, exact outlined Lanrith wordmark, mobile disclosure. Uses `--bg` or `--surface`.
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
Brand reference: “Your homelab’s first hop.” Promise: “A homelab router with the hard parts already figured out.” These are the approved brand statements, not evidence of release readiness. The console keeps operational labels specific to the observed state. Approved paths: `context/lanrith-brand/copy/brand-copy.txt` and `context/lanrith-brand/assets/logo/lanrith-primary.svg` / `lanrith-reverse.svg`.

Plain operational language, sentence case, exact units and observation timestamps. “No observations since 09:14”, “Origin unavailable”, “Shared rule counter”, “Identity provider unavailable”. Distinguish last success from current health. Label predictions, sampling and unknowns beside the value. Never imply signing into the console grants device firewall access. Correlated events do not establish cause. Documentation keeps source facts separate from inferred values.

## 9. Implementation Notes & Anti-patterns
- **Implementation Notes:** Ensure React/HTML components map directly to semantic CSS tokens. Components must be modular, accept semantic props (e.g., `status="warn"` maps to `--warn` tokens). All icons should be accessible with `aria-hidden` when decorative, and accompanied by screen-reader text when functional.
- **Anti-patterns:** No marketing hero, giant headings, decorative gauges, glowing status dots, gradient washes, traffic particles, emoji icons, excessive cards, or rounded cards with coloured left borders. No colour-only status. No invented per-device counters, physical switch topology, application identity from port alone, or universal health score. No one-click allow, rule editor, image activation, or service restart in this read-only system. No household identifiers, external runtime fonts/CDNs, hardcoded provider, backend framework choice, or remote deployment. Preserve the source documents and existing package identity.
