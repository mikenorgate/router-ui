# Phase 3 runtime overlay — integration log

Date: 2026-10-14. Model: openrouter/moonshotai/kimi-k3 (reasoning: max).

Integrated the `design/phase3-handoff` investigation surfaces into the clean
policy-phase baseline, as an overlay that edits nothing outside
`design/phase3-runtime/`.

- **Baseline (read-only source):** `…/ourhouse-cluster/ansible/homelab/.cache/router-console-policy-phase/ui-next/web` (rc.11)
- **Handoff (read-only source):** `design/phase3-handoff`
- **Overlay (all writes):** `design/phase3-runtime/web` — sources under `web/src`,
  package scaffolding copied unmodified from the baseline, `node_modules` a
  symlink to the baseline's install so tests/builds resolve identical deps.

## Steps (in execution order)

1. **Scaffold** — copied baseline `web` (src minus `types.ts.orig`, configs,
   index.html, .storybook, public, scripts) into `design/phase3-runtime/web`;
   symlinked `node_modules`.
2. **Handoff overlay** — copied the 10 phase-3 components (each with its
   Storybook story), `lib/{contracts,phase3Api,phase3Demo,phase3Scale}.ts`,
   and the two new route pages (`NetworkExposurePage`, `AccessExplanationPage`).
3. **Simulation removed** (VALIDATION.md: simulated outcomes are outside the
   approved passive backend):
   - `contracts.ts` — `predicted_outcome` field deleted; header rule now reads
     "Outcomes are never simulated."
   - `phase3Demo.ts` — both `predicted_outcome` fixture values deleted;
     `inv-access-flow-03` keeps `observed_decision: null` + unresolved questions.
   - `AccessExplanation.tsx` — "Simulated outcome" badge block deleted; copy now
     "No outcome is inferred." / "An observed verdict does not establish
     application connectivity…".
4. **Page merges** (baseline export names preserved — `interactions.test.tsx`
   and `policy-pages.test.tsx` import them directly):
   - `OverviewPage` — kept `/overview` metric strip, inventory counts and
     sources; added `/traffic/summary` interval chart (gaps, accounting,
     sampling kinds, reconciliation), device traffic ranking with the
     unattributed bucket, linked recent events, and the `?observation=`
     inspector.
   - `TrafficPage` — flows|DNS tabs, `ServerFilterBar`, `?observation=` deep
     link via `ObservationInspector`; records without a reference keep the
     legacy flow inspector; returned pages are additionally narrowed by
     `filterFlows` client-side; Viewer gets `AccessDeniedNotice` with no
     sensitive request fired.
   - `DeviceDetailPage` — tabs `summary · traffic · dns · firewall · addresses
     · history`. Annotations (`AnnotationEditor`) and the firewall
     `PoliciesPanel` (embedded snapshot vs server-filtered pages) are intact.
     Traffic tab carries the shared-window `TimeWindowLanes` plus ref-backed
     conversations; DNS tab uses `DnsTable`; history links events to
     observations. Phase-3 resources fetch only while their tab is active, so
     the firewall-tab tests still see a single `/devices/:id` snapshot request.
   - `EventsPage` — severity/kind as server filters (`eventsPath`),
     `LinkedEventsTimeline`, observation inspector; `filterEvents` narrows the
     returned page client-side.
   - `App.tsx` — added `/network/exposure` and `/investigations/:ref`.
   - `NetworkPage` — "Configured exposure ↗" action in the page header.
5. **Demo transport** — extracted base fixtures to `lib/demoData.ts` (breaks
   the demo.ts ↔ phase3Demo.ts evaluation cycle; `lib/demo` re-exports the
   fixtures so existing imports are unchanged). `createDemo` calls
   `handlePhase3Demo(route, url, session.user.role)` before the `/flows`
   branch. Handlers apply the contract's server filters (verdict/family/
   protocol/translation/window via `filterFlows`, severity/kind/window/q/
   device for events, rcode/q/device for DNS) and role checks (Viewer: 403 on
   flows/DNS/observations/investigations; summaries remain). `event-1` carries
   `observation_ref: obs-event-01`.
6. **CSS** — `@import` paths rebased to `../../../design/…` (router-ui's
   canonical tokens, byte-identical to the baseline's). Appended an additive
   phase-3 block: `.chart-wrap` positioning for the tooltip, `.chart-tip`
   (+`[hidden]`), `.chart-hover-line`, `.chart-dot`, `.chart-selected`,
   `.cell-num`, `.filter-note`, `.policy-path`, `.unresolved-list`.
7. **ExposurePanel** — inbound rows now render their evidence note under the
   state badges (per-row uncertainty, incl. "Shared rule counter").
8. **IntervalSummaryChart** — tolerates a summary payload without `interval`
   (optional-chained), fixing a crash when an API returns a partial body.

## Tests

- Copied baseline suites unchanged except one expectation in
  `lib/demo.test.ts` (`/flows` now attaches evidence `sources` beside the
  bounded page — `toMatchObject`).
- New `src/test/phase3-contract.test.ts` — path builders; Viewer/Operator role
  checks; reference resolution independent of list paging; not-retained 404s;
  server filters (flows/events/DNS); accounting/sampling/gap/unattributed
  fields; exposure never verified; **no simulated outcomes in any
  investigation payload**.
- New `src/test/phase3-surfaces.test.tsx` — overview merge + ranking
  inspector; traffic deep link (`?verdict=blocked&observation=obs-flow-02`
  resolves a record outside the filtered page); DNS tab by arrow key; Viewer
  denial without sensitive requests; device firewall/annotations preserved,
  shared-window lanes + ref-backed conversations; events server filter
  restated + linked observation; exposure uncertainty; access explanation with
  provenance and unresolved questions and no simulation; unobserved subject
  stays unknown.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `tsc --noEmit` (in `design/phase3-runtime/web`) | exit 0 |
| Tests | `vitest run` | **9 files, 84 tests, all passing** |
| Build | `vite build` | ok — 41.85 kB CSS, 404 kB JS, 5 local Plex faces |

## Review fixes — round 2 (2026-10-14, same model/settings)

Independent-review findings, all writes confined to `design/phase3-runtime/`:

1. **DNS contract realigned to the backend** (`internal/model/model.go` DNS:
   `query`/`type`/`result`/`answers []string`). `DnsObservation` now carries
   backend names plus `answers?: string[]|number|null` (fixture compatibility),
   `answer_records [{name,type,value,ttl}]`, `client_ip` and `binding`.
   `lib/dns.ts` accessors prefer backend names with legacy-alias fallback;
   `DnsAnswers` renders recorded answer values and TTLs (not a bare count) in
   both `DnsTable` and the `ObservationInspector` DNS branch.
2. **Atomic window selection.** `useFilters.setWindow(from,to)` performs one
   `setSearchParams` that writes both bounds and drops `range`/`cursor`
   (the old two-`set` sequence read stale params and lost `from`).
   `TimeWindowLanes` on the device traffic tab uses it; cross-page selections
   via `href()` now drop `range` whenever `from`/`to` are present. URL
   assertions: `src/test/hooks.test.tsx` + a keyboard-select surface test.
3. **Server-authoritative pages.** `filterFlows`/`filterEvents` removed from
   `TrafficPage`/`EventsPage`; the helpers remain in `lib/filters.ts`
   explicitly for the demo transport. `src/test/server-authoritative.test.tsx`
   proves a returned record renders even when it contradicts the active
   verdict/window/severity/kind filters, and `interactions.test.tsx` now
   asserts predicates go upstream while the returned page renders as-is.
4. **Flow record-state filter + detail.** `state` added to `flowsPath`, the
   Traffic filter bar, the demo transport, `Flow` types and rows; inspection
   (FlowDetail + ObservationInspector) shows `namespace`/`zone`/
   `observation_point`, `translated_source_port`/`destination_port`,
   `policy_revision` and `binding_ref`.
5. **Events kinds.** Selector gained telemetry/network/service/clock; an
   active kind outside the known list stays visible as `Unknown kind: …`.
6. **AccessExplanation** now presents "Recorded policy context": copy states
   the evidence may contain only one historically retained rule, hook/order
   are recorded attributes, and no evaluation order is reconstructed
   (no /simulat/i text rendered). Related events render from
   `investigation.events` via the linked timeline.
7. **URL state.** `set('observation', …)` preserves `cursor`; `clear()` keeps
   fixed `from`/`to` plus `tab` (and `range`); device summary "Recent
   conversations" opens the observation inspector when a record carries
   `observation_ref`, falling back to the legacy inspector otherwise.
8. **Ranking identity.** `TrafficRanking` rows use composite local ids
   (`device@qualifier#index`), show the accounting-point qualifier, a
   server-truncation note (`rankings_truncated`), and a never-summed-across-
   points notice whenever one device ranks at several accounting points.
9. **CSS path normalization.** `src/styles.css` now carries the exact
   production imports (`../../design/colors_and_type.css`,
   `../../design/build/reference.css`); `vite.config.ts`
   `normalize-design-css-paths` rewrites only those specifiers to the
   canonical files at build time, so the overlay stays byte-identical to a
   production install and Storybook/preview builds keep working.
10. **Actual-data alignment.** DNS fixtures send real answer values/TTLs and
    nullable latency (one legacy-shaped record pins compatibility; an
    unmeasured latency renders "Latency unavailable", never `0 ms`).
    Device-scoped summaries omit `reconciliation` when interface bytes are
    unmeasured; rankings with null bytes stay "Unavailable". Inbound exposure
    rows carry Policy `name`/`conditions`/`observed_at`, rendered verbatim
    with provenance. Tests updated to the actual data shapes.

### Evidence (round 2)

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `tsc --noEmit` (in `design/phase3-runtime/web`) | exit 0 |
| Tests | `vitest run` | **11 files, 100 tests, all passing** |
| Build | `vite build` | ok — 41.85 kB CSS (canonical tokens verified in output), 412 kB JS, 5 local Plex faces |

## Review fixes — round 3 (2026-10-14, same model/settings: openrouter/moonshotai/kimi-k3, reasoning max; design system: Router Console Design System, `design/DESIGN.md` + `design/tokens.css`)

Scoped production-overlay refinements against the read-only baseline
(`…/router-console-policy-phase/ui-next/web`, rc.11). All writes confined to
`design/phase3-runtime/`; the UI stays read-only/passive. Verified against
the actual backend contract in the baseline worktree (`internal/httpapi`,
`internal/model`): `/export` (`kind=flows|dns`, else 400 `invalid_export`,
operator-only, `Limit=500`, `{items, bounded, limit, exported_at}`), DNS
record fields (`transaction_id`, `answer_count`, `answers_omitted`,
`query_at`), `Flow.zone uint16`, device detail `current_inventory`.

1. **Demo export routed through the authoritative filters.** `/export` moved
   into `handlePhase3Demo`; the dead `/flows || /export` fallthrough in
   `demo.ts` is removed. `kind=flows` runs `filterFlows` (window, verdict,
   protocol, family, translation, **state**) + device_id/q; `kind=dns` runs
   the new `filterDns` in `lib/filters.ts` (q, device_id, **rcode**, **resolver**,
   window on observation time) — the same function the `/dns` collection now
   uses. Both are bounded to **500** records and respond
   `{items, bounded:true, limit:500, exported_at}` mirroring the backend;
   unsupported/missing kinds reject 400 `invalid_export`; Viewer stays 403
   for either kind.
2. **DnsAnswers regressions.** The `answers_omitted` warning now renders in
   the bare-values branch too (shared `OmittedNote`), with `answer_count`
   when recorded; `dnsAnswerCount` returns null for `UNOBSERVED_RESPONSE`
   before any numeric path (unknown answers, never zero). Inspector metadata
   (query_at, transaction_id, binding frozen at observation time) covered;
   `dns-01` fixture enriched with backend fields (`query_at`,
   `transaction_id`, `answer_count`).
3. **ExportButton coverage.** DNS selected URL filters/window/device asserted
   upstream (tab state excluded), bounded completion message
   ("Downloaded up to 500 matching …"), viewer restriction without a request;
   Blob URL + anchor click stubbed (jsdom has no blob store), no navigation.
4. **Backend field shapes.** `Flow.zone` widened to `string | number`
   (backend `uint16`, omitempty); `DeviceDetail.current_inventory?: boolean`
   added. Demo `/devices/:id` falls back to retained history
   (`demoHistoricalDevices`, status `historical`, `current_inventory:false`)
   and keeps CSRF-protected annotation writes for retained devices. The page
   qualifies the identity — "Not in current inventory" badge, "Last recorded
   associations", retained-history callout — without implying current
   presence; the annotations editor stays enabled.
5. **Retained-count copy.** Device DNS tab and conversations (decision
   timeline) panels state: "Counts are retained observations after
   raw-detail sampling, not totals." No numeric fill invented.

New suites (32 tests, prior 100 preserved untouched): `lib/filters.test.ts`
(8), `test/export.test.tsx` (8), `components/DnsAnswers.test.tsx` (8),
`test/device-history.test.tsx` (8). `DnsAnswers.stories.tsx` gained
OmittedTypedRecords / OmittedBareValues / UnobservedResponse variants.

### Evidence (round 3)

| Check | Command | Result |
| --- | --- | --- |
| Tests | `npx vitest run` from disposable root `design/phase3-runtime/.testroot` (overlay configs, baseline node_modules symlink; deleted after) | **15 files, 132 tests, all passing** (100 prior + 32 new) |
| Typecheck + build | `npm run build` from the same root | exit 0 — CSS byte-identical to round 2 (`index-_p_nrSAB.css`, 41.85 kB; the `@import` resolve warning is pre-existing), JS 415.54 kB, 5 local Plex faces |

## Review fixes — round 4 (2026-10-14, same model/settings: openrouter/moonshotai/kimi-k3, reasoning max; design system: Router Console Design System, `design/DESIGN.md` + `design/tokens.css`)

Two real-API contract refinements against the read-only baseline
(`…/router-console-policy-phase/ui-next/web`, rc.11). All writes confined to
`design/phase3-runtime/`; original web/backend untouched; the explanation
stays passive and never simulates a path.

1. **Investigation envelope realigned to the actual API.** `AccessInvestigation`
   now carries required `identity: RecordIdentity` (`{ref, kind, source_id,
   boot_id, record_id, recorded_at}`) and no required top-level `ref`; the
   actual envelope `{identity, subject, observed_decision, policy_path,
   binding, translation, events, limits, unresolved_questions, sources}` is
   documented on the contract. The legacy fixture `ref` stays optional so
   older fixtures and assertions keep resolving. Demo investigations carry
   full identity (record ids `inv-0094` / `inv-0097`) beside the legacy ref.
2. **Readable record heading.** `AccessExplanationPage` heads the panel with
   the short producer record id (`Explanation inv-0094`), never the opaque
   resolution reference, which can run to hundreds of characters and would
   not survive a narrow layout. `AccessExplanation` gains an "Investigation
   record" section exposing the recorded observation source, router boot,
   producer record and capture time (Fields/keylist, mono,
   `overflow-wrap: anywhere`).
3. **Zone 0 preserved.** `ObservationInspector`'s observation-point join no
   longer drops the valid numeric conntrack zone 0 (the backend serializes
   the zone as uint16, omitempty): zero renders explicitly as "Zone 0";
   other numeric zones render as recorded (pinned by the existing
   device-history test: `forwarding · 7 · egress-interface`).

New suites (6 tests, prior 132 preserved untouched):
`components/ObservationInspector.test.tsx` (4 — zone 0 preserved with and
without namespace/observation point, non-zero numeric as recorded, string
label verbatim) and `test/access-envelope.test.tsx` (2 — actual envelope
with no top-level ref and a 300-character opaque reference: resolution by
opaque ref over the wire, heading bounded to the short record id, the opaque
ref rendered nowhere; recorded source/boot/record/capture-time identity
visible; passive copy with no /simulat/i text).

### Evidence (round 4)

| Check | Command | Result |
| --- | --- | --- |
| Tests | `npx vitest run` from disposable root `design/phase3-runtime/.testroot` (overlay configs, baseline node_modules symlink; deleted after) | **17 files, 138 tests, all passing** (132 prior + 6 new) |
| Typecheck + build | `npm run build` from the same root | exit 0 — CSS byte-identical to rounds 2–3 (`index-_p_nrSAB.css`, 41.85 kB, canonical tokens verified `--bg:oklch(97.5% .005 95)`), JS 416.53 kB, 5 local Plex faces |

## Review fixes — round 5 (2026-10-14): CI test scheduling

**Failure (public log:** `…/router-console-policy-phase/phase3-release-ci-failure.log`,
release `v0.2.0-rc.12`, step `npm test --prefix web` **):** 136 of 138 tests
passed; the two heavy pagination interaction tests in
`src/test/datatable-pagination.test.tsx` — "reaches and inspects rule-501…"
(650 rules) and "returns to the first client page when the evidence filter
changes" (300 rules) — timed out at 5191 ms and 5176 ms against their
5000 ms gates. All 138 pass locally. Root cause is scheduling, not
assertions or data: Vitest's default worker count scales with the runner's
CPUs, so the small GitHub runner ran too many jsdom files concurrently and
the CPU-bound interaction tests starved (log: "jsdom was created 17 times").

**Correction (`web/vitest.config.ts`, the only file changed):** workers
bounded to a small CI runner. `maxWorkers: 2` was tried first and still
contended under a genuine 2-core constraint (`taskset -c 0,1`: rule-501 at
5155 ms), so the suite runs on `maxWorkers: 1` with per-file isolation kept
(`isolate: true`, the default, stated explicitly). No assertions, data
sizes, timeout gates, product UI, or dependencies were changed; no tests
skipped.

### Evidence (round 5)

| Check | Command (from `design/phase3-runtime/web`) | Result |
| --- | --- | --- |
| Full suite, bounded config | `npm test` | **17 files, 138 tests, all passing** — 32.69 s |
| Constrained 2-core check | `taskset -c 0,1 npx vitest run --reporter=verbose` | **17 files, 138 tests, all passing** — 31.08 s; rule-501 **4100 ms** (gate 5000 ms), evidence-filter **1888 ms**, refreshed-snapshot **1794 ms** |
| Focused rerun, 2-core | `taskset -c 0,1 npx vitest run src/test/datatable-pagination.test.tsx` | 9/9 passing; rule-501 **4049 ms** |
| Failed intermediate | `taskset -c 0,1` with `maxWorkers: 2` | rule-501 5155 ms — motivated `maxWorkers: 1` |
| Typecheck | `npm run typecheck` | exit 0 |

**CI rerun pending.** These are local results under a simulated 2-vCPU
constraint; the release pipeline has not been re-run and no CI success is
claimed here. The next release run should confirm the gates hold on the
actual runner.

## Scope

`git status` shows only `design/phase3-runtime/` added by this run. Original
`web/`, backend (`internal/`, `cmd/`), `design/phase3-handoff/` and the
baseline worktree were not edited (their `M` entries pre-date this run).
Round-3 diff vs baseline touches only the 13 files listed above under
`design/phase3-runtime/web/src`; round 4 edits the 5 files and adds the 2
test files listed above under the same root. No runtime router was touched.

## Not done / open

- Browser visual verification of the integrated app (daemon export timed out
  in the previous session as well); the phase-3 preview artifact already
  passed jsdom + one visual render in the handoff.
- Storybook build not re-run; handoff component stories are copied verbatim
  and typecheck under the repo's strict flags.
