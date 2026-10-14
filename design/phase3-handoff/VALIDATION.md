# Phase 3 handoff — run evidence and validation

Date: 2026-10-14. Session: `01a139c1-7f89-7269-a429-d860daac37ef`.

## Run evidence

| Item | Value | Source |
| --- | --- | --- |
| Design-system attachment | `user:router-console-design-system` — active and verified; its injected text matches `design/DESIGN.md` on disk (tokens, Plex fonts, evidence-state rules) | session context, read of `design/DESIGN.md` |
| Resolved model | `openrouter / moonshotai/kimi-k3` | `PI_PROVIDER`, `PI_MODEL` environment |
| Effective reasoning setting | `max` | `PI_REASONING_LEVEL` environment |
| Project | `router-ui` (`OD_PROJECT_ID 3f8d4985-55cb-4c6c-b1ab-f45d855a89ba`) | environment |

## Commands and results

| Check | Command | Result |
| --- | --- | --- |
| Handoff TypeScript | `cd design/phase3-handoff && ../../web/node_modules/.bin/tsc -p tsconfig.json` | **exit 0** — 30 TypeScript source files (10 components, 10 stories, 4 library modules and 6 pages) compile under the repo's strict flags (`strict`, `noUncheckedIndexedAccess`, `noUnusedLocals/Parameters`), resolving existing `web/src` modules via `rootDirs` overlay |
| Preview build | `python3 design/phase3-handoff/preview/build_preview.py` | wrote `artifacts/router-console-phase3.html` (241,152 bytes); canonical `design/tokens.css` inlined verbatim; 5 local Plex woff2 faces embedded as data URIs with OFL attribution |
| Preview validation | `node design/phase3-handoff/tools/check_preview.mjs` (repo's jsdom, no package changes) | **pass, 60+ assertions, zero network requests, zero runtime errors** — coverage below |
| Visual render | `od export artifacts/router-console-phase3.html --format image` | first render captured and reviewed (`preview/render-overview.png`, 347 KB); found 4 layout defects → fixed (below). Re-render attempt blocked by daemon timeout (`UND_ERR_HEADERS_TIMEOUT`) — infrastructure unavailability, not the artifact; fixes verified statically in the built file and by the passing jsdom suite |

### jsdom assertion coverage (`tools/check_preview.mjs`)

- Standalone file: no external `src`/`href`, all CSS `url()` are data URIs or internal `#fragment` SVG refs, 5 embedded font faces.
- Boots at Overview; all **seven** nav sections navigate and keep active parent (Exposure keeps Network active).
- Overview: interval chart renders with labelled gap; ranking shows the unattributed bucket and accounting kind.
- Traffic: server filter bar present; bounded page labelled; verdict filter applies; **deep-link inspector opens `obs-flow-02` while the list is filtered to blocked-only** (record outside current page resolves by reference); identity block shows source/boot/kind/record; close clears the URL param.
- DNS tab reachable by ArrowRight key; resolver answers render.
- Device: shared-window lanes render with labelled gaps; DNS tab table renders; expired binding `192.0.2.19` remains visible in history.
- Events: severity server filter removes info events and is restated beside the list.
- Exposure: no-scan uncertainty banner; 3 listeners; shared-counter labelling.
- Access explanation: observed decision, policy provenance chain, binding and translation evidence, 3 unresolved questions; unobserved variant shows "No observed decision" and labelled simulated outcome.
- Viewer role (driven through the fixture control): traffic and investigation show permission-limited; summary surfaces remain.
- Theme toggle applies dark theme and persists to localStorage; `aria-controls` targets resolve; internal hash links all map to handled routes.

### Defects found by visual render and fixed

1. Mobile-nav toggle visible at desktop width — `.btn` specificity overrode the hide rule; scoped to `.sidebar .mobile-nav-toggle`.
2. Chart tooltip ignored its `hidden` attribute — added `.chart-tip[hidden] { display: none }`.
3. `Unavailable` wrapped mid-word in narrow numeric cells — added `.cell-num` (nowrap, tabular) to numeric cells; address cells still wrap anywhere.
4. Sticky sidebar tiled in full-page captures — sidebar no longer sticky.

## Scope verification

`git status --porcelain` after the work shows exactly two new paths —
`artifacts/router-console-phase3.html` and `design/phase3-handoff/` — and no
modifications attributable to this run (pre-existing `M` entries are the
user's unrelated in-progress edits, untouched). No package manifests, design
tokens, existing pages, or backend files were changed. Nothing was deployed;
no external runtime services or fonts are referenced.

## Independent integration check

The preview checker dependency path was corrected to resolve the application’s web package. A standalone `phase3Scale.ts` removes the handoff’s dependency on an unreleased formatter change. Both the preview checker and strict TypeScript check now pass in the isolated rc.11 application worktree, based on commit `0c9ad16c0e10181cf594d55b7f6a8220cd6d630c`. The preview makes zero network requests and reports zero runtime errors. These pages are an authoring handoff; they are not integrated into the deployed console. Simulated-outcome examples are outside the approved passive Phase 3 backend and must be removed when integrating access explanations. Browser visual verification of the final integration remains required.
