# Lanrith Console design brief

Create a reusable Open Design design system for a standalone router observatory. Working product name: Lanrith Console. Audience: technically curious home-network owners and homelab operators. The dominant experience is fast investigation of metrics, devices, and applied policy.

This is a design-system initialization, not a request to implement the full application. Provide a documented visual language, semantic tokens for light and dark themes, reusable component specimens, and representative composition examples. Keep backend and frontend framework choices open.

## Product constraints

- The router image is immutable. The interface is mostly read-only; safe console-owned writes include annotations, saved investigations, and preferences.
- UI, API, collectors, storage, and local authentication live on the router. No external monitoring platform, cloud controller, CDN, remote font service, or site-specific dependency is required.
- OAuth/OIDC login supports any configured compatible provider. Local recovery remains available when the provider is unreachable. Include provider-unavailable and session-expired examples.
- Every device can show applied firewall rules and their origin: image baseline, configuration revision, inherited segment/group policy, or a locally received dynamic grant. Show provenance, scope, version, lifetime, and observation time.
- Distinguish installed, applicable, and observed-match states. Shared counters must not look like per-device counts. Predicted reachability is separate from an observed verdict or successful application connection.
- Unknown, missing, sampled, stale, unsupported, and unobserved data must be designed states. A router cannot see traffic that stays inside an unrelated switch.

## Visual direction

Use a calm, precise instrument-panel aesthetic. Take interaction cues from UniFi's focused topology and inspectable tables, and Firewalla's device-to-flow-to-rule progression. Establish an independent identity; do not reproduce either brand.

Use warm off-white/white surfaces in light mode and graphite/slate in dark mode. Teal is the selection/action accent. Reserve green, amber, and red for labelled operational states, with separate treatments for unknown and stale evidence. Use a compact route-junction symbol as a simple original mark.

Prefer IBM Plex Sans and IBM Plex Mono, bundled locally with their licence if available; use sensible system fallbacks without a network fetch at runtime. Use tabular figures, clear IP addresses, aligned units, and a small readable type scale. Normal UI text should remain comfortably readable, with adjustable density for large tables.

Build around a compact labelled sidebar, page title, shared time selector, broad aligned time-series charts, and information-dense tables. Use thin dividers, modest radii, restrained elevation, and generous grouping between related sections. Avoid promotional hero layouts, excessive cards, glossy gradients, decorative gauges, glowing status dots, or constant traffic animation.

The seven navigation sections are Overview, Devices, Traffic, Network, Firewall, Events, and System. Breadcrumbs and page titles preserve location. Search accepts names, IPv4/IPv6, MAC addresses, domains, and rule IDs. A side inspector supports quick detail; full pages support longer investigations.

## Required reusable patterns

1. Metric value with unit, change, sample age, and optional sparkline.
2. Aligned line/area charts with a legend, event marker, selected time interval, missing-data gap, and sampled-data annotation.
3. Device row and device header with multiple addresses, explicit presence evidence, segment, activity, and readable status.
4. Dense sortable/filterable table, row selection, pagination or bounded loading, empty state, and keyboard focus.
5. Firewall rule row and detail panel with action, scope, conditions, lifecycle, provenance chain, and installed/applicable/observed-match badges.
6. Flow detail with original/translated tuples and a supported explanation of the observed rule path.
7. Incident/event timeline with correlated changes and clear timestamps.
8. Global search, time range, filters, tabs, breadcrumbs, tooltips, copy controls, and non-destructive buttons.
9. Login, configured OIDC provider button, local recovery entry, session expiry, access denied, and provider unavailable.
10. Loading, empty, stale, error, unsupported, and no-observation states; permission-limited fields and exports.

Show components in a small coherent operational composition: an overview excerpt, a device Firewall tab, and a flow/provenance inspector. A full application with backend data is outside this task. All demonstration records must be fictional and labelled as examples.

## Accessibility and interaction

Support keyboard navigation and clearly visible focus, accessible names, labelled status icons, reduced motion, 200 percent zoom, mobile inspection, and readable chart alternatives. Verify text contrast targets of 4.5:1 for normal text and 3:1 for large text, and 3:1 for essential control boundaries and graphical indicators. Do not encode allow/deny or traffic direction only through colour.

Use specific copy: “No observations since 09:14”, “Origin unavailable”, “Shared rule counter”, and “Identity provider unavailable”. Avoid certainty that the evidence cannot support.

## Deliverables

Create the native Open Design design-system manifest and expected package files: DESIGN.md, semantic tokens.css, structured design-tokens.json when supported, components.html, README.md, and a useful preview entry. Include usage guidance for future agents and local assets/licences if needed. Keep tokens and specimens consistent, make light/dark switching work, and avoid external runtime requests.

The design system should remain a draft for user review. Do not publish a site, create a remote repository, implement router operations, or alter other Open Design projects.
