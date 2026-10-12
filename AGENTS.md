# Router Console contributor guidance

Read `docs/PRODUCT_PLAN.md`, `docs/DESIGN_BRIEF.md`, and `design/DESIGN.md` before implementing UI features. Reuse the semantic tokens and component rules in `design/`.

- Keep the product standalone and site-neutral. Do not hardcode a homelab's names, addresses, VLAN numbers, groups, or external services.
- Bundle runtime assets locally. Open Design is an authoring tool, not an appliance dependency.
- Keep router configuration read-only by default. Console-owned annotations and preferences are separate from router policy.
- Distinguish installed rules, applicable rules, and observed matches. Preserve policy provenance, observation time, and address-binding history.
- Support provider-neutral OAuth/OIDC and local recovery. Signing into the console does not grant a device firewall access.
- Show missing, stale, sampled, and unsupported evidence explicitly. Do not invent physical topology, application identity, or per-device counters.
- Preserve keyboard operation, visible focus, status text, readable charts, and reduced-motion support in both themes.
- Keep collection and queries bounded and independent of forwarding. Avoid adding external infrastructure or choosing a backend framework merely to build a design preview.
