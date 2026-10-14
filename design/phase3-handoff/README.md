# Phase 3 handoff — investigation surfaces

Phase 3 of `docs/PRODUCT_PLAN.md` ("First useful observatory release"): flow
investigation, linked timelines, observed verdicts, passive access
explanations, and the exposure view — extending the existing seven-section
console. Exposure lives under **Network**; access explanations open from a
flow inspector and stand alone as shareable pages.

Everything is passive and read-only: no scan, ping, probe, rule editor, image
activation, or service restart. All fixtures are fictional (documentation
addresses, example names) and visibly labelled.

## Layout

```
src/lib/contracts.ts      Phase 3 API payload types (additive over web/src/types.ts)
src/lib/phase3Api.ts      Path builders for proposed endpoints (wrap existing query())
src/lib/phase3Demo.ts     Fictional fixtures + demo transport (wire into lib/demo.ts)
src/components/*.tsx      10 components, each with a matching .stories.tsx
src/pages/*.tsx           6 pages (drop-in route elements)
preview/                  Standalone preview sources (body/styles/app + build script)
tools/check_preview.mjs   jsdom validation for the built artifact
```

`tsconfig.json` uses `rootDirs: [./src, ../../web/src]` so files import
existing modules (`../lib/api`, `./Badge`, …) at exactly the paths they will
have after integration. Validate without copying:

```
web/node_modules/.bin/tsc -p design/phase3-handoff/tsconfig.json   # run from repo root
```

## Components → stories

| Component | Surface it serves |
| --- | --- |
| `EvidenceNotices` | Stale, partial, unsupported, overflow, sampling (source vs storage), accounting kind, gap, access-denied notices |
| `TrafficRanking` | Overview device ranking; unattributed bucket row; shares are of attributed traffic only |
| `IntervalSummaryChart` | Overview interval chart (reuses `Chart`) with gap bands, accounting/sampling qualifiers, reconciliation note |
| `ServerFilterBar` | Filter controls that are server-applied before pagination, with that fact restated |
| `DnsTable` | DNS observations with resolver/rcode/latency/age; Viewer-redacted variant |
| `ObservationInspector` | Direct-link inspector resolving `/observations/{opaque_ref}` — works for records outside the current list page; identity block shows source/boot/kind/record |
| `AccessExplanation` | Observed decision vs labelled simulated outcome vs application connectivity; policy path with provenance; binding validity; translation evidence; unresolved questions; limits |
| `ExposurePanel` | Configured listeners, forwarding rules, inbound permissions with source restrictions and per-row uncertainty |
| `TimeWindowLanes` | Device traffic/DNS/connections lanes on one shared axis with binding/event markers and table alternatives |
| `LinkedEventsTimeline` | Event timeline where each item can open its underlying observation by reference |

## Pages → routes to register in `web/src/App.tsx`

| Page | Route | Notes |
| --- | --- | --- |
| `OverviewInvestigationPage` | `/overview` | Replaces/extends current OverviewPage |
| `TrafficInvestigationPage` | `/traffic` | `?tab=flows|dns`, server filters, `?observation=` deep link |
| `DeviceTimeWindowPage` | `/devices/:id` | Shared window lanes + conversations/DNS/history tabs |
| `EventsTimelinePage` | `/events` | `severity` and `kind` sent as server filters |
| `NetworkExposurePage` | `/network/exposure` | Breadcrumb under Network |
| `AccessExplanationPage` | `/investigations/:ref` | Full-page form; inspector links here |

Filters, time window (`range`/`from`/`to`), tab and selection all persist in
the URL through the existing `useFilters`; browser back returns to the prior
investigation.

## Proposed API contract

| Endpoint | Filters (server-side) | Role |
| --- | --- | --- |
| `GET /api/v1/traffic/summary` | `range`/`from`/`to`, `segment`, `family`, `device_id` | Viewer+ |
| `GET /api/v1/observations/{opaque_ref}` | — (by reference only; independent of list paging) | Operator+ for flow/DNS kinds |
| `GET /api/v1/investigations/{opaque_ref}` | — | Operator+ |
| `GET /api/v1/exposure` | — | Viewer+ |
| `GET /api/v1/flows` (extended) | + returns `observation_ref` per row | Operator+ |
| `GET /api/v1/dns` (new) | `q`, `device_id`, `rcode`, `resolver`, window, `limit`/`cursor` | Operator+ |
| `GET /api/v1/events` (extended) | + `severity`, `kind` now server filters; items gain `observation_ref` | Viewer+ |

References carry identity, not just an ID: `source_id`, `source_kind`,
`boot_id`, `record_id`, `recorded_at` (`RecordIdentity` in contracts.ts).
`traffic/summary` keeps `live-interval` vs `completed-flows` accounting and
`source_rate` vs `storage_rate` sampling as separate fields, with explicit
`gaps` and an `unattributed` bucket reconciled against interface totals.

## Integration steps

1. Copy `src/` into `web/src/` (paths already match; `rootDirs` validated this).
2. Delete `handoff-env.d.ts` (web's `vite/client` types take over).
3. Register the six routes above in `App.tsx`.
4. In `web/src/lib/demo.ts`, call `handlePhase3Demo(route, url, session.user.role)` before the existing `/flows` branch and the final 404 fallthrough.
5. Add one CSS rule to `web/src/styles.css` for numeric cells:
   `.cell-num { white-space: nowrap; }` (prevents "Unavailable" wrapping mid-word in narrow columns; addresses still wrap anywhere).
6. Optional: expose the stories — they follow the existing
   `@storybook/react-vite` format and the global router/fixture decorators.

## Evidence rules enforced in UI copy

- Unknown verdicts stay unknown; predicted outcomes are labelled simulated;
  conntrack presence never claims application success.
- Ports and DNS names never identify applications; resolver metadata shows its
  association age.
- Correlated events never claim cause; the expired-grant example states this.
- Loading, empty, stale, partial, unsupported, overflow and access-denied are
  designed states (see the System → Evidence states reference in the preview).
- Viewer sessions keep summaries; traffic/DNS/investigation detail renders the
  permission-limited state, enforced server-side by role.

See `VALIDATION.md` for run evidence and check results.
