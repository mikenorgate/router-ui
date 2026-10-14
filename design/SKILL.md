---
name: router-console-design-system
description: Reuse the Lanrith Console instrument-panel system for standalone immutable-router investigation UI.
user-invocable: true
---
# Lanrith Console design-system usage

## What is inside
`DESIGN.md` defines the rules. `tokens.css` and `colors_and_type.css` bind semantic colours, spacing, radius and local typography. `design-tokens.json` is a structured light/dark export. `components.html` opens the native reference. `preview/` contains focused review cards. `ui_kits/app/` contains modular TypeScript components, paired Storybook stories and small compositions. `assets/` holds the exact approved Lanrith primary/reverse wordmarks and junction marks; `fonts/` holds variable Manrope, Plex Mono and correctly paired OFL licences. `build/` holds reference styles; `scripts/` holds TypeScript export, build and validation tooling.

## Source Context
Based on the copied evidence in `docs/DESIGN_BRIEF.md`, `docs/PRODUCT_PLAN.md` and `context/source-context.md`. Read `context/provenance.md` for source versus inferred decisions. The existing identity is `user:router-console-design-system`; keep it unchanged. This workspace is a draft package, separate from its linked application repository.

## When to use
Use for prototypes or interfaces that investigate local router metrics, devices, firewall policy, flow paths and access failure. Do not use this package to implement live routing, rule editing or provider-specific auth. Keep framework choices open.

## How to use
1. Read README.md and DESIGN.md, then inspect the relevant Storybook story and preview card.
2. Load colors_and_type.css and the canonical tokens.css instead of copying inline token definitions. Use Brand.ts for exact approved outlined lockups: primary in light mode, reverse in dark mode. Keep the supplied geometry and one accessible name.
3. Copy a role component and its story, compose the required surface, and replace fixtures only with evidence-qualified records.
4. Keep runtime assets local. Rebuild structured tokens and browser output with `pnpm build:reference`, then rebuild Storybook with `pnpm build:storybook`.
5. Validate themes, zoom/mobile layout, keyboard operation and local links. Run the native package audit with `--fail-on-warnings` before handoff.

## Design system highlights
Paper light surfaces and neutral charcoal/grey dark surfaces; 16px Manrope body with compact headings and metadata; Plex Mono identifiers; 4px spacing scale; 44px controls; modest radius; restrained Teal/Mint actions and selection; labelled status colours. Dark metadata, borders, unknown states and chart fills stay grey. Preserve the canonical inset accent indicator on active navigation and the approved reverse wordmark. The current dark theme follows the user's latest refinement of the supplied brand kit, recorded in `context/provenance.md`. Broad neutral chart lanes have missing-sample gaps and data alternatives. Policy badges distinguish installed/applicable/observed matches. Shared counters, simulated results and unknown origin remain explicit. Provider-neutral OIDC and local recovery do not grant a device firewall access. All example records are fictional.

## Brand reference
Use “Your homelab’s first hop.” and the approved promise “A homelab router with the hard parts already figured out.” Source: `context/lanrith-brand/copy/brand-copy.txt`. Fonts and logo assets are provided by `context/lanrith-brand/`; preserve original source documents and separate brand statements from operational evidence.
