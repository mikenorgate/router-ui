# Open Design workflow

The Lanrith console application project is linked directly to this Git working directory. Its design system has a separate native Open Design workspace and the existing registry entry `user:router-console-design-system`. The reusable package is exported to `design/` so the repository can be used without Open Design running.

Machine-specific project IDs and the current daemon/web URLs live in `.opendesign.local.json`, which Git ignores. Open Design may choose different ports after a restart; use its configured IPC discovery when available.

Use the design-system workspace to change tokens, components, previews, and design guidance. Validate the package there, then export the updated package into `design/` following [EXPORT.md](../design/EXPORT.md) and review the Git diff. Keep the native package slug `router-console-design-system` and full `registryId` unchanged. Copy canonical files and trees without overwriting unrelated application or Phase 3 material; record source checksums in `design/export-provenance.json`.

The approved Lanrith brand supersedes the provisional Router Console name, inferred palette, original junction mark and Plex Sans typography in the historical product brief. The application uses Paper light and neutral charcoal dark themes with restrained mint accents, local Manrope and IBM Plex Mono, and exact outlined primary/reverse wordmarks and marks from the exported package. Product label: **Lanrith console**. The approved tagline and promise remain in brand documentation; dashboard space is reserved for operational evidence. Evidence semantics and read-only router behaviour still follow the product plan.

The product requirements remain in [PRODUCT_PLAN.md](PRODUCT_PLAN.md), with the design task in [DESIGN_BRIEF.md](DESIGN_BRIEF.md). The implementation uses React/TypeScript with Vite in `web/` and an independent Go service. Page creation and visual changes go through this existing Open Design project with its attached `user:router-console-design-system`. The exported design package supplies local tokens, fonts, licenses and evidence conventions.

Page generation and refinement use the Pi harness with
`openrouter/google/gemini-3.1-pro-preview:xhigh`. The installed model catalog
normalises the requested `xhigh` reasoning to effective `high`; validation records
both values. Verify the attached design system and resolved provider/model in
local launch metadata. Keep raw sessions and credentials out of releases.

The 14 October 2026 frontend brand integration used the installed **Codex runner** as a one-off fallback after repeated upstream HTTP 429 failures. The Pi/Gemini configuration above remains the documented default. [VALIDATION.md](VALIDATION.md) records the runner actually used and the application checks; the shared package's validation reports describe its independent review.
