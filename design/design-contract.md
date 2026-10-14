# Lanrith Console design contract

Target: a native reusable Open Design design-system package, including small operational compositions. Audience: technically curious network owners and operators investigating an immutable standalone router. Status: draft for user review.

## Evidence and confidence
| Evidence | Confidence | Use |
| --- | --- | --- |
| `context/source-context.md` | provided | Existing source project and immutable package identity. |
| `docs/DESIGN_BRIEF.md` | provided | Visual direction, reusable components, accessibility and deliverables. |
| `docs/PRODUCT_PLAN.md` | provided | Evidence semantics, firewall provenance, standalone boundary and access states. |
| UniFi / Firewalla cues described in those documents | provided, not independently observed | Investigation progression only; no screenshots or protected assets copied. |
| `context/lanrith-brand/tokens/lanrith.css`, `assets/logo/` and `copy/brand-copy.txt` beneath the same brand root | provided | Approved Lanrith palette anchors, exact outlined identity and messaging. |
| Semantic colour derivatives, compact scales and fictional fixtures | inferred | Instrument-panel roles retain the original investigation semantics; body size is the approved 16px. |
| Latest user feedback: "the all green is a bit over the top" | provided | Refine dark UI roles to neutral charcoal/grey; retain restrained Mint/Teal accents and the supplied brand assets. |
| Manrope variable file and OFL in `context/lanrith-brand/`; Plex Mono and legacy Plex Sans in `fonts/` | observed | Local Manrope 200–800 and Plex Mono; unused Plex Sans retains its correct upstream licence. |

## Reference boundaries
| Reference | Keep | Change | Do not copy |
| --- | --- | --- | --- |
| Copied design brief | Paper light / charcoal dark themes, teal actions, density, labelled evidence | Replace prose-only rules with tokens and specimens | Do not invent brand facts missing from the source. |
| Copied product plan | Device → flow → policy investigation; standalone local assets | Limit the delivered scope to design-system examples | Do not implement forwarding, router writes or infrastructure. |
| UniFi semantic cues | Focused topology, inspectable aligned tables | Approved Lanrith identity; original investigation layout | Logos, screenshots, literal product layouts. |
| Firewalla semantic cues | Device-to-flow-to-rule progression | Explicit installed/applicable/observed distinctions | Brand marks, claims or proprietary UI. |
| Initial root scaffold | Existing identity and source links | Fill empty design sections and package guidance | Preserve source docs without silently rewriting evidence. |

## Frozen stance
Paper light surfaces and neutral charcoal/grey dark surfaces with locally bundled Manrope and Plex Mono typography, modest radii and thin dividers. Grey chart fills align measurements in time; Mint/Teal identifies actions, selection, focus and chart lines. Active navigation retains the canonical inset accent indicator. Status colours always have words and symbols. Provenance and uncertainty are part of the ordinary interface. The current dark roles implement the user's latest UI-theme refinement; copied source evidence and original brand assets remain intact.

## Risks and unknowns
Exact runtime datapath, policy evaluator, retention budgets and authentication configuration remain application decisions. The samples cannot establish real connectivity. The local font subset covers Latin; other scripts use system fallbacks. Source docs contain conceptual references, not observed visual screenshots. Brand palette anchors are provided; semantic derivatives are documented in provenance. Static contrast validation checks actual token pairs; manual assistive-technology and real device review remain part of user acceptance.

## Quality gate
- [x] Nine standard DESIGN.md sections plus explicit product context.
- [x] Target, audience, provided evidence and inferences identified.
- [x] Keep/change/do-not-copy boundaries specified for each reference.
- [x] One coherent stance with precise anti-patterns.
- [x] Operational handoff and local component stories.
- [x] Functional theme, bounded filters and evidence inspection examples.
- [x] Final package audit and local validation: see `context/validation.json` and `context/package-audit.json`.
