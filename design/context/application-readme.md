# Lanrith Console

A standalone, mostly read-only web UI for an immutable router. It combines network metrics, device history, traffic investigation, and explanations of applied firewall policy.

The UI, API, collectors, authentication support, and bounded history storage belong on the appliance. Core operation must work without an external monitoring stack, controller, identity provider, or internet connection. Federated sign-in uses provider-neutral OAuth/OIDC, with independent local recovery access.

This repository starts with the product plan and an Open Design design system. Application implementation and framework selection are still pending.

- [Product plan](docs/PRODUCT_PLAN.md)
- [Design brief](docs/DESIGN_BRIEF.md)
- [Design system](design/DESIGN.md)
- [Component reference](design/components.html)

Open Design is the design-time authoring tool. Its project links directly to this repository; the reusable design-system package is exported under `design/`. Open Design is not a runtime dependency of the router UI.
