---
name: router-console-design-system
description: Reuse the Router Console instrument-panel system for standalone immutable-router investigation UI.
user-invocable: true
---
# Router Console design-system usage

## What is inside
`DESIGN.md` defines the rules. `tokens.css` and `colors_and_type.css` bind semantic colours, spacing, radius and local typography. `design-tokens.json` is a structured light/dark export. `components.html` opens the native reference. `preview/` contains focused review cards. `ui_kits/app/` contains modular TypeScript components, paired Storybook stories and small compositions. `assets/` holds the original route mark; `fonts/` holds Plex and licences. `build/` holds generated reference styles and the local build script.

## Source Context
Based on the copied evidence in `docs/DESIGN_BRIEF.md`, `docs/PRODUCT_PLAN.md` and `context/source-context.md`. Read `context/provenance.md` for source versus inferred decisions. The existing identity is `user:router-console-design-system`; keep it unchanged. This workspace is a draft package, separate from its linked application repository.

## When to use
Use for prototypes or interfaces that investigate local router metrics, devices, firewall policy, flow paths and access failure. Do not use this package to implement live routing, rule editing or provider-specific auth. Keep framework choices open.

## How to use
1. Read README.md and DESIGN.md, then inspect the relevant Storybook story and preview card.
2. Load colors_and_type.css and the semantic tokens instead of hardcoding values.
3. Copy a role component and its story, compose the required surface, and replace fixtures only with evidence-qualified records.
4. Keep runtime assets local. Rebuild generated browser output with `pnpm build:reference`.
5. Validate themes, zoom/mobile layout, keyboard operation and local links. Run the native package audit with `--fail-on-warnings` before handoff.

## Design system highlights
Warm off-white and graphite surfaces; small Plex typography; 4px spacing scale; 44px controls; modest radius; teal actions; labelled status colours. Broad neutral chart lanes have missing-sample gaps and data alternatives. Policy badges distinguish installed/applicable/observed matches. Shared counters, simulated results and unknown origin remain explicit. Provider-neutral OIDC and local recovery do not grant a device firewall access. All example records are fictional.
