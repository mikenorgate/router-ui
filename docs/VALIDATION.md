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

The earlier snapshot-phase frontend had 36 passing tests, including foreground polling without
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


## Phase 3 local qualification

Activity tests cover immutable completed identities, active expiry at read time,
exact observation references across boots, filtered pagination, frozen DNS
bindings, replay-safe intervals, missing buckets, bounded sums, retained counts
and historical-device authorization. API tests commit actual v2 snapshots before
investigating a recorded rule revision, and assert nonempty flow/DNS exports.
The full race suite, vet and configured Go linter pass.

The MCP-authored React pages use the existing design system through Pi with
`openrouter/moonshotai/kimi-k3`, requested `xhigh` and effective `max` reasoning.
Tests cover server-authoritative filters, direct references, TTLs, omitted DNS
values, unavailable responses, historical devices, bounded exports, role checks,
keyboard interaction and fixed windows. Local browser walkthroughs cover both
themes and 390-pixel layouts. These are proxy checks, not a human usability study.

See [performance measurements](PERFORMANCE.md) for the ten-minute mixed load,
ten paired baseline/candidate samples and policy publication coexistence gate.
Router-owned native fixtures additionally verify actual Unix ingestion and lost
acknowledgements, rc.10 read/maintenance/reopen, packaged Unbound, kernel verdict
preservation, Alloy queue/rotation/disk pressure and Suricata EVE reopening.

The current phase excludes physical load/fault/forwarding benchmarks and live
OIDC configuration. VM boot/update/rollback platform qualification remains
explicitly deferred. Signed router candidate and production acceptance require
the existing deployment workflow and fresh accepted-core audit; local fixture
results do not constitute that acceptance.
