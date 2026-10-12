# Open Design workflow

The Router Console application project is linked directly to this Git working directory. The Router Console Design System has its own native Open Design workspace and registry entry. The reusable package is exported to `design/` so the repository can be used without Open Design running.

Machine-specific project IDs and the current daemon/web URLs live in `.opendesign.local.json`, which Git ignores. Open Design may choose different ports after a restart; use its configured IPC discovery when available.

Use the design-system workspace to change tokens, components, previews, and design guidance. Validate the package there, then export the updated package into `design/` and review the Git diff. Do not silently let the registry and repository copies diverge.

The project is initialized with a working visual direction for review. Open Design's local library availability is separate from publishing a website or deploying the router UI. No public hosting or remote repository is required.

The product requirements remain in [PRODUCT_PLAN.md](PRODUCT_PLAN.md), with the design task in [DESIGN_BRIEF.md](DESIGN_BRIEF.md). The implementation uses React/TypeScript with Vite in `web/` and an independent Go service. Page creation and visual changes go through this existing Open Design project with its attached `user:router-console-design-system`. The exported design package supplies local tokens, fonts, licenses and evidence conventions.
