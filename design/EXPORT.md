# Router Console design export

Source: `user:router-console-design-system`, workspace package `a074a105-4b59-43a6-9a70-304651c57a48`, exported from the supplied local Open Design project.

Copied unchanged: `DESIGN.md`, `tokens.css`, `colors_and_type.css`, `design-tokens.json`, `manifest.json`, `components.manifest.json`, `design-contract.md`, `implementation-handoff.md`, `SKILL.md`, `components.html`, `router-console-system.html`, and the `fonts/`, `assets/`, `build/`, `ui_kits/`, `storybook/`, `preview/` trees. Source provenance, source context and the supplied contrast report are preserved under `context/`.

The frontend adapts Badge, Sidebar, Metric, Chart, PolicyTable, Inspector and AuthPanel into React components. Their original TypeScript reference sources and stories remain under `ui_kits/app/components/`. React stories live under `../web/src/`; application composition uses the canonical tokens and reference CSS. Application CSS adds routing-layout and responsive rules without adding palette values. Fonts retain both OFL licence files.
