# Validation and release qualification

Application checks use local fixtures, a real SQLite store, a real Unix socket and a signed local OIDC test provider. Run:

```sh
go test -race -shuffle=on -tags=integration ./...
go vet -tags=integration ./...
golangci-lint run
go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 ./...
npm --prefix web test
npm --prefix web run build
```

Tests cover cursor rollback/replay, deterministic storage sampling, summary accounting before sampling, raw-span retention, local recovery/session origin binding, API permissions/exports/CSRF, Unix peer UID authorization, metric gaps and OIDC signature/issuer/audience/expiry/nonce/PKCE/state replay. The app uses synthetic documentation-range fixtures; no test needs a particular site's services.

Router qualification belongs to the router build and its component repositories. Before enabling the service on an appliance, record evidence for:

| Check | Required result |
| --- | --- |
| Offline operation/provider outage | Local recovery, inventory and local history work; new federated login fails clearly. |
| IPv4/IPv6 management | Every explicit origin works with correct certificate/callback; unadmitted networks remain denied; isolated OOB routing is unchanged. |
| Source semantics | Host/service/VPP counters stay distinct; bindings are attributed at event time; original/NAT tuples and verdict limitations are documented. |
| Policy provenance | Trace baseline/group/dynamic rules to a device and installed revision; unknown origin remains visible; expiry is not mistaken for confirmed removal. |
| Source interruption | Cursor replay survives producer/console restarts; sequence gaps and log rotation loss are shown; remote Loki outage does not stop local history. |
| Telemetry pressure | Hard filesystem capacity contains SQLite/WAL and metric compaction; seven-day flow span samples sooner; summaries and essential router state stay protected. |
| Availability | Stop/kill the console, fail its database/mount and exhaust its quota; forwarding, DHCP, DNS, firewall and A/B boot continue. |
| Performance | Measure forwarding throughput and latency with collection enabled/disabled under high churn; qualify CPU/memory/IO limits and sampling. |
| Upgrade/rollback | Verify artifact checksums and schemas, back up durable state, boot both slots, and restore compatible console state without router DB changes. |

The application repository does not certify unimplemented router producers, actual datapath coverage, installed `/var` capacity, physical topology, or live forwarding performance. Those need appliance evidence before a production release. Active diagnostics, general rule-path prediction and deeper dependency/daily-summary workflows remain later product stages.

## Application verification on 12 October 2026

The Go race suite, vet and golangci-lint passed. The dependency scan reported no reachable vulnerabilities. All 28 frontend interaction/API tests, TypeScript and production builds passed; Open Design also built the Storybook and verified its compiled preview boots in an opaque frame and navigates without network requests.

Chromium checks against the real fixture appliance covered local login, every core route, the device Firewall tab and producer provenance, server-side traffic filters, retention bounds and persistence, annotation saving, both themes, and the 390-pixel mobile layout. No JavaScript errors, page error alerts or horizontal mobile overflow were observed. Both Linux amd64 and arm64 archives were built; the amd64 artifact was extracted, its internal checksums verified and its version command executed. These checks do not replace the router qualification matrix above.

## Snapshot and provenance prerelease

The snapshot protocol stages exact producer wire bytes, validates the complete
ordered generation and activates it atomically. Integration tests cover durable
staging across a process restart, unchanged acknowledgements on replay, missing
chunks, conflicts, stale producer sequences, scope removal and the inventory
ceiling. Device policy filtering happens before pagination; a fixture with more
than 500 applications checks that boundary.

The phase frontend has 36 passing tests, including foreground polling without
overlapping requests, fixed intervals, draft preservation, refresh failures and
policy disappearance. Its compiled Open Design preview navigates all seven
pages without network requests. The Go race suite and static checks run against
the application independently of appliance services.

Release builds produce inert amd64 and arm64 Debian packages and archives.
`console-release.json` binds their source commit, toolchains, contract versions,
individual package files and security reports. Repeat builds must compare byte
for byte before publication. These checks qualify application artifacts; router
boot, network isolation, storage failure and forwarding gates still require the
router-owned candidate workflow.

## Lanrith frontend integration — 14 October 2026

This Open Design application run used the installed **Codex runner** as a one-off fallback after repeated upstream HTTP 429 failures. It did not use Pi/Gemini. The documented default in [OPEN_DESIGN.md](OPEN_DESIGN.md) remains Pi with `openrouter/google/gemini-3.1-pro-preview:xhigh`, normalised by the catalog to effective `high`.

The completed shared design package was consumed without regeneration: 196 exported files match their canonical source byte-for-byte and by SHA-256. Its existing native package slug and registry ID are unchanged. The export includes the reviewed CSS and matching `context/browser-validation.json`. The package's independent reports record 774 checks, 86 contrast pairs, a clean native audit and 52 Chromium views; those are shared-package results, separate from the application checks below. See [export provenance](../design/export-provenance.json).

The reviewed dark theme uses charcoal #171B1E, grey panels #20262A and raised surfaces #2A3236. Metadata, borders, unknown states and chart fills are neutral, with Mint reserved for the logo, chart lines, selection, primary controls and focus. The light palette is unchanged. Active navigation retains the shared inset marker. The final application checks below were rerun after this refinement; the shared package passed all 86 contrast pairs and 52 browser views.

All required commands from `web/` passed:

| Command | Result |
| --- | --- |
| `npm run typecheck` | Passed with no TypeScript errors. |
| `npm test` | 67 tests passed in 7 files. Existing route/auth tests now also check the product title and accessible wordmark. |
| `npm run build:preview` | Production and explicit-demo builds passed; compiled `about:blank` smoke test visited all seven sections with zero network requests or runtime errors. Embedded assets, favicon and Manrope licence checks passed. |
| `npm run build:storybook` | Passed with the local Lanrith wordmark, favicon and component stories. Vite reported the Storybook bundle-size advisory; npm also reported inherited environment-config advisories. |

Chromium inspection covered 56 file-URL route views at 320, 390, 768 and 1440 pixels in light/dark themes, plus 28 opaque sandboxed iframe route views at 390 and 1440 pixels and four sign-in views. Checks found no page overflow, broken visible logos, missing Manrope, runtime errors or external requests. Reduced motion, search, mobile navigation, theme switching, density and keyboard route focus worked. Desktop/mobile captures were inspected for logo readability and compact layout. The native Open Design renderer also exported the application preview successfully.

The real API, auth, preview-mode selection and demo adapter sources match the supplied pre-integration baseline. API failure still shows an error rather than enabling fixtures. SHA-256 comparison confirms all 223 protected backend, deployment and Phase 3 files are unchanged; pre-existing frontend investigation changes are retained. Router configuration was not modified. These are frontend checks using explicit fixtures, not new appliance qualification.

Application preview: [router-console-preview.html](../router-console-preview.html), with an identical active mirror at [artifacts/router-console.html](../artifacts/router-console.html). Both are generated from `web/`; Phase 3 artifacts remain separate. [Application brand validation](../web/brand-validation.json) records the runner, checks and preservation results. No publish, deployment or commit was performed.
