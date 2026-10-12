# Router Console design contract

Target: a native reusable Open Design design-system package, including small operational compositions. Audience: technically curious network owners and operators investigating an immutable standalone router. Status: draft for user review.

## Evidence and confidence
| Evidence | Confidence | Use |
| --- | --- | --- |
| `context/source-context.md` | provided | Existing source project and immutable package identity. |
| `docs/DESIGN_BRIEF.md` | provided | Visual direction, reusable components, accessibility and deliverables. |
| `docs/PRODUCT_PLAN.md` | provided | Evidence semantics, firewall provenance, standalone boundary and access states. |
| UniFi / Firewalla cues described in those documents | provided, not independently observed | Investigation progression only; no screenshots or protected assets copied. |
| Exact OKLCH values, sizes, fictional fixtures and route mark | inferred | New original implementation of the locked direction. |
| IBM Plex files and licences in `fonts/` | observed | Locally bundled typography from Fontsource 5.3.0 packages. |

## Reference boundaries
| Reference | Keep | Change | Do not copy |
| --- | --- | --- | --- |
| Copied design brief | Warm/graphite themes, teal actions, density, labelled evidence | Replace prose-only rules with tokens and specimens | Do not invent brand facts missing from the source. |
| Copied product plan | Device → flow → policy investigation; standalone local assets | Limit the delivered scope to design-system examples | Do not implement forwarding, router writes or infrastructure. |
| UniFi semantic cues | Focused topology, inspectable aligned tables | Original route mark, tokens and layout | Logos, screenshots, literal product layouts. |
| Firewalla semantic cues | Device-to-flow-to-rule progression | Explicit installed/applicable/observed distinctions | Brand marks, claims or proprietary UI. |
| Initial root scaffold | Existing identity and source links | Fill empty design sections and package guidance | Preserve source docs without silently rewriting evidence. |

## Frozen stance
Warm off-white and graphite instrument surfaces with locally bundled Plex typography, modest radii and thin dividers. Neutral chart lanes align measurements in time. Teal identifies actions and selection; status colours always have words and symbols. Provenance and uncertainty are part of the ordinary interface.

## Risks and unknowns
Exact runtime datapath, policy evaluator, retention budgets and authentication configuration remain application decisions. The samples cannot establish real connectivity. The local font subset covers Latin; other scripts use system fallbacks. Source docs contain conceptual references, not observed visual screenshots. Palette values are inferred. Static contrast validation checks actual token pairs; manual assistive-technology and real device review remain part of user acceptance.

## Quality gate
- [x] Nine standard DESIGN.md sections plus explicit product context.
- [x] Target, audience, provided evidence and inferences identified.
- [x] Keep/change/do-not-copy boundaries specified for each reference.
- [x] One coherent stance with precise anti-patterns.
- [x] Operational handoff and local component stories.
- [x] Functional theme, bounded filters and evidence inspection examples.
- [x] Final package audit and local validation: see `context/validation.json` and `context/package-audit.json`.
