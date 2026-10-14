# Lanrith Console design-system package

Draft v0.1 for user review. Existing registry identity: `user:router-console-design-system`. The native manifest uses package slug `router-console-design-system` and records the full identity in `registryId`; these refer to the same existing entry.

## Product Overview
“Your homelab’s first hop.” The approved promise is “A homelab router with the hard parts already figured out.” The brand source is [Lanrith copy](context/lanrith-brand/copy/brand-copy.txt); the console specimens retain the original evidence semantics.

Lanrith Console is a standalone observatory for an immutable router and edge OS. The application helps operators investigate measurements, devices, traffic and installed firewall policy. It supports provider-neutral OIDC with local recovery and keeps the console outside the forwarding path. This package provides reusable design components and four small compositions, incorporating the approved Lanrith brand identity. It does not implement a backend, router operations or a production application.

The current dark theme uses charcoal #171B1E, grey panels #20262A and raised grey #2A3236. Metadata, borders, unknown states and chart fills are neutral; Mint/Teal remains on selection, controls, focus and chart lines. This follows the user's latest UI-theme refinement of the supplied brand kit. Paper light mode and the exact outlined brand assets remain unchanged; see [provenance](context/provenance.md).

## Source Context
The source project is Lanrith Console (`3f8d4985-55cb-4c6c-b1ab-f45d855a89ba`). This existing design-system workspace keeps its identity and source evidence: [source context](context/source-context.md), [design brief](docs/DESIGN_BRIEF.md), and [product plan](docs/PRODUCT_PLAN.md). Those copied documents are preserved. The original application README and agent guidance are in [context/application-readme.md](context/application-readme.md) and [context/application-agents.md](context/application-agents.md). [Provenance](context/provenance.md) distinguishes provided evidence from inferred design values. References to UniFi and Firewalla are semantic cues described in the source documents; no protected screenshots or brand assets were copied.

## Package Contents

| Entry | Purpose |
| --- | --- |
| [router-console-system.html](router-console-system.html) | Package overview and review entry. |
| [storybook/index.html](storybook/index.html) | Main design reference: local static Storybook. |
| [components.html](components.html) | Local redirect to the native component reference. |
| [ui_kits/app/index.html](ui_kits/app/index.html) | Browser-reviewable modular specimen composition. |
| [DESIGN.md](DESIGN.md), [SKILL.md](SKILL.md) | Visual contract and future-agent usage. |
| [tokens.css](tokens.css), [colors_and_type.css](colors_and_type.css) | Canonical semantic themes and local font bindings. |
| [design-tokens.json](design-tokens.json) | Native `od-design-tokens/v1` structured export. |
| [manifest.json](manifest.json), [components.manifest.json](components.manifest.json) | Native package identity and specimen contracts. |
| [design-contract.md](design-contract.md), [implementation-handoff.md](implementation-handoff.md) | Evidence decisions and next implementation instructions. |
| `preview/` | Focused colour, typography, spacing, component and identity cards. |
| `ui_kits/app/components/` | Reusable TypeScript components, paired Storybook stories, generated local browser bundles. |
| `assets/` | Lanrith junction mark and wordmark. |
| `fonts/` | Local variable Manrope, Plex Mono, their SIL OFL licences, and unused legacy Plex Sans with its own correct licence. |
| `build/`, `scripts/` | Reference stylesheet and TypeScript build/validation tooling. |

## Preview Manifest

| Card | Review focus |
| --- | --- |
| [preview/colors-foundations.html](preview/colors-foundations.html) | Semantic roles, both themes, essential versus decorative boundaries. |
| [preview/typography-specimens.html](preview/typography-specimens.html) | 16px Manrope body, compact headings, Plex Mono identifiers and observation age. |
| [preview/spacing-density.html](preview/spacing-density.html) | 4px rhythm, comfortable/compact rows, 44px targets. |
| [preview/components-controls.html](preview/components-controls.html) | Actions, focus, native inputs and permission-limited export. |
| [preview/components-evidence.html](preview/components-evidence.html) | Policy evidence, provenance and shared counters. |
| [preview/components-charts.html](preview/components-charts.html) | Filled neutral series, event marker, sampled gap and table alternative. |
| [preview/brand-assets.html](preview/brand-assets.html) | Lanrith mark, wordmark and font licences. |

## Applied compositions

- [Overview](ui_kits/app/overview.html): metrics, aligned timelines, missing samples, affected devices and correlated events.
- [Device Firewall](ui_kits/app/device-firewall.html): searchable/filterable/sortable rules, all source types, observation gaps, expiry, inspector and a labelled simulated fixture outcome. Other device tabs contain short evidence examples.
- [Flow inspector](ui_kits/app/flow-inspector.html): original tuple, translation uncertainty, attributed denial, recorded hook path, source chain and permission-limited export.
- [Authentication/errors](ui_kits/app/access-states.html): configured generic OIDC provider, provider outage, provisioned local recovery, validation, expired session and access denied.

## Review Workflow
Start with Storybook for isolated components; use the native `ui_kits/app/` compositions for an operational walkthrough. Inspect the Firewall tab, filter to unknown/stale evidence, open POL-108, and compare its expired lifetime with its stale install snapshot. Then follow POL-042 into the recorded flow. Switch themes, change density, use keyboard tabs and modal Escape, and inspect the chart data alternative. On a narrow viewport or at 200% zoom, navigation becomes a disclosure and tables become labelled records.

The static package needs no CDN or external font. All browser assets are local. Theme/density preferences may use localStorage; recovery credentials never do. OIDC and recovery screens are local design examples and do not authenticate. All metrics, counters, names and addresses are fictional, with documentation-range addresses and `.example` domains.

## Reuse Workflow
Read DESIGN.md and the component contract. Copy a TypeScript component and its paired story; load colors_and_type.css followed by build/reference.css. Use tokens rather than new palette values. Keep source producer, inherited scope, revision, lifetime and observation time visible. An installed rule, an applicable rule and an observed match must remain separate. A simulated policy result does not prove connectivity.

Install only within this workspace using `corepack pnpm --ignore-workspace install --store-dir .tmp/pnpm-store`. Then:

```sh
pnpm export:tokens
pnpm typecheck
pnpm build:reference
pnpm storybook
pnpm build:storybook
pnpm validate
"$OD_NODE_BIN" "$OD_BIN" tools connectors design-system-package-audit --path . --fail-on-warnings
```

`pnpm build:reference` regenerates the structured token export as well as the browser bundles. Validation compares both resolved themes independently against CSS declarations and checks asset and licence bindings.

`storybook-config/` is a portable copy of the workspace’s `.storybook/` configuration, refreshed by the Storybook build. Native registry downloads exclude hidden directories; both copies use the same component sources and local assets.

TypeScript is canonical; `.js` components and `storybook/` are generated compatibility/runtime outputs. Stories use the HTML/Vite framework to avoid selecting a production app framework; see the [official Storybook configuration guide](https://storybook.js.org/docs/configure/index). Validation evidence is in [context/validation.json](context/validation.json), [context/contrast-report.json](context/contrast-report.json), and [context/package-audit.json](context/package-audit.json), [current browser checks](context/browser-validation.json), and [neutral dark overview](context/dark-theme-overview.png). The earlier [native visual review](context/visual-review.png) is historical evidence from before the dark-theme refinement. Assistive-technology and real-device review remain user acceptance work. Do not publish or create another project/identity.

## Existing local registry refresh

For an authorized refresh of this linked package, `corepack pnpm exec tsx scripts/refresh-registry.ts` uses the installed native `updateUserDesignSystem` and bounded `writeProjectFile` primitives. It requires passing validation/audit reports and the daemon-provided data root, asserts the existing registry/workspace IDs, preserves the registry lifecycle, and verifies every written byte. It does not import a new package or write the database. Registry evidence is recorded in `context/registry-refresh.json` and the downloaded archive comparison in `context/registry-verification.json`.
