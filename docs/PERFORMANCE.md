# Performance validation

The store has benchmarks for initial complete snapshots, unchanged generations, shared rule revisions, complete removal, current device pages, device policy pages, policy history and policy reads during retention. They use the real SQLite implementation and public ingestion contracts. Fixture creation, staging and database setup are excluded from the measured operations.

The policy fixture contains eight inherited rules across 4,096 devices: 32,776 records within the 32 MiB contract. Query fixtures also contain 4,096 current devices. Each benchmark checks the returned record count. `BenchmarkDevicePolicyCapacityDuringRetention` runs the real maintenance owner concurrently and waits for it to stop before closing storage.

Run benchmarks with the pinned Go toolchain:

```sh
GOMAXPROCS=1 go test -tags=integration -run '^$' \
  -bench 'Benchmark(CompletePolicy|PolicyLifecycle)Capacity' \
  -benchtime=1x -benchmem -count=10 ./internal/store
GOMAXPROCS=1 go test -tags=integration -run '^$' \
  -bench 'Benchmark(CurrentDevice|DevicePolicy|HistoricalDevicePolicy)' \
  -benchtime=50x -benchmem -count=10 ./internal/store
```

The Linux cgroup v2 wall-clock acceptance test is separate from normal CI and race tests:

```sh
GOMAXPROCS=1 go test -tags=integration,capacity \
  -run '^TestCompletePolicyCapacity(Deadline|CancellationKeepsAcknowledgement)$' -v ./internal/store
```

Run that test only on a recorded native environment with the declared one-CPU and 2 GiB limits. It verifies effective kernel CPU, memory and swap ceilings, then checks initial commit, shared rule revision and complete removal against an eight-second wall-clock limit. It records process CPU time, cgroup throttling and block I/O alongside elapsed time. A second test cancels after new WAL pages appear, checks that the previous generation and cursor remain unchanged, and replays the same upload. Its replay budget checks recovery separately from latency. A timeout or missing resource isolation is not a pass.

For container isolation, compile a static test binary and run it inside an explicitly selected local Linux image. Mount an owned writable evidence directory and set `TMPDIR` there; the databases need more than a small container `/tmp` mount. Use no networking, no capabilities, a one-CPU quota, a 2 GiB memory ceiling, a 2 GiB memory-plus-swap ceiling and a bounded PID count. Record the image identity, Go version, CPU model, source identity and exact invocation with results.

For before/after comparisons, use the identical benchmark source, fixture, toolchain and limits on both revisions. Interleave baseline and candidate runs in alternating order. Keep at least ten samples of each and compare them with `benchstat`; retain time, bytes allocated and allocation counts. Small samples and noisy shared runners do not establish a regression or an improvement. Keep setup outside the timer and retain raw results rather than only a percentage.

The October 2026 validation also exercises the packaged application through UID-checked ingestion and authenticated HTTP requests while complete generations commit. Router-owned publisher benchmarks separately compare chunk construction and assert identical public wire bytes. Those integration probes belong to the router repository; this application does not depend on its collectors, deployment topology or benchmark runner.

## Recorded component measurements

Go 1.26.9 on an AMD Ryzen Threadripper 2950X, with one CPU and a 2 GiB hard memory ceiling, produced these interleaved ten-sample `v0.2.0-rc.4` results against `v0.2.0-rc.2`:

| Initial 32,776-record complete commit | Baseline | Candidate |
| --- | ---: | ---: |
| Median operation time | 9.191 s | 3.596 s |
| Allocated bytes per operation | 585.8 MiB | 327.4 MiB |
| Allocations per operation | 8.595 million | 3.647 million |

`benchstat` reported p < 0.001 for all three comparisons. The time confidence intervals were wide: ±12% for baseline and ±49% for candidate. This shared-host result establishes a component improvement, not predictable worst-case router latency.

Three runs of 50 operations each measured median run averages of 0.69 ms for a 500-device page, 10.75 ms for one device's eight policies, 44.05 ms for its policy history and 15.02 ms for policy reads during retention. These are store-operation averages, not HTTP p95 measurements. Earlier native wall-clock checks completed initial commit, shared rule revision and complete removal in 3.34, 5.50 and 4.46 seconds respectively. A later disk-backed rerun exceeded the eight-second revision limit at 8.09 seconds. Preserve both observations; the earlier pass does not establish a stable deadline guarantee.

The `v0.2.0-rc.5` revision path reuses validated application-to-rule references and skips old-body comparisons when the changed definition already requires history. Ten interleaved samples against `rc.4` measured median revision time of 7.371 to 4.547 seconds (p=0.019), allocated bytes of 698.9 to 343.1 MiB, and allocations of 10.103 to 3.386 million (p<0.001 for both allocation comparisons). Time intervals remained wide: ±36% and ±38%.

An early development rerun still exceeded eight seconds once. Three subsequent disk-backed checks with measured kernel limits, CPU time and throttling passed, as did three tmpfs diagnostics. Tmpfs excludes disk durability cost and is CPU diagnostic evidence only. These results do not close storage/deadline qualification on a stable appliance runner. Retain failed timings, raw measurements and runner conditions; do not repeat until a passing sample appears and discard the failures.

The `v0.2.0-rc.8` writer uses a 32 MiB SQLite page-cache target and applies every writer setting to replacement connections. An interrupted connection previously reopened without its capacity limit, foreign-key enforcement or configured busy timeout. The replacement regression now checks both databases, rejects an orphaned chunk and proves that an oversized write leaves prior rows intact. Full synchronous durability, WAL checkpoints and read-only reader limits remain in place.

Ten interleaved revision benchmarks against `rc.6`, using the same fixture, Go 1.26.9 and enforced one-CPU/2 GiB/no-swap limits, measured median operation time of 4.589 to 3.807 seconds: 17.05% lower (p=0.002). Allocated bytes and allocation counts did not differ significantly. Maximum process RSS across the complete fixtures rose from approximately 128 to 187 MiB. These peaks include staging and setup, which are excluded from operation timing.

A packaged `rc.6` API run still timed out a shared revision at 8.01 seconds. After the writer change, one strict disk-backed run completed initial commit, shared revision and complete removal in 3.47, 5.87 and 5.01 seconds. Real post-WAL cancellation and replay also passed with writer settings checked after recovery. Retain the failed package result alongside these component measurements; they do not establish a stable deadline guarantee on the eventual router image.

Component benchmarks do not qualify a signed router image, filesystem exhaustion behavior, physical forwarding or NIC/VPP performance. The deployment owner must perform those acceptance checks against the exact installed artifact.


## Phase 3 activity qualification

The opt-in `TestActivityCapacity` fixture contains 4,096 devices, 65,536 active
connections, one million retained flows and 245,760 minute aggregate rows.
Measured traffic uses the real `Store.Ingest`, query and retention owners;
bulk SQL is limited to fixture construction. The final ten-minute workload
mixes active snapshots, completed flows, DNS, events and interval accounting.
It paces 1,000 records/second, adds a 2,000/second ten-second burst, bounds the
queue to 128 batches and drains it before checking totals.

At one CPU, 2 GiB and zero swap, all 610,048 produced records committed,
including 19,968 burst records. Summary p95 was 0.694 seconds; device-flow,
filtered-flow and direct-reference p95 were 0.031, 0.012 and 0.047 seconds.
Peak backlog was three batches and maximum measured visibility delay was
0.794 seconds. The local fixture reported no errors. A follow-up full-size
measurement covers the final partial-bucket query qualifier.

`TestActivityPolicyCoexistence` clones the closed synthetic fixture, verifies
kernel cgroup limits and runs real ingestion and queries during 32,776-record
policy publication. Initial commit, revision and removal took 7.892, 6.663 and
7.998 seconds, within the unchanged eight-second gate. Query p95 was 1.342
seconds. All 108,032 produced records committed; three cancelled attempts
replayed without advancing an uncommitted cursor. Maximum visibility delay
was 14.920 seconds. The removal result has almost no margin: this local pass
does not establish a stable deadline guarantee on router hardware.

Ten interleaved baseline/candidate samples against rc.10 used the same cached
Go 1.26.9 toolchain, one CPU, 2 GiB and zero swap. Benchstat found no significant
time difference in complete policy commit, current-device pages or device
policy pages. Indexed historical device-policy lookup fell from a median
35.469 ms to 0.241 ms (99.32% lower). Its allocated bytes fell 17.19%; allocation
count rose from 122 to 263. Complete-commit timing intervals were wide (±77%).
Keep raw samples and failed development experiments alongside these results.

Run these qualifications only against owned disposable fixture directories:

```sh
ROUTER_ACTIVITY_QUALIFY=1 ROUTER_ACTIVITY_SECONDS=600 \
  ROUTER_ACTIVITY_OUTPUT=/absolute/empty/fixture \
  go test -tags=integration -run '^TestActivityCapacity$' -v ./internal/store
ROUTER_ACTIVITY_COEXIST=/absolute/cloned/qualified/fixture \
  go test -tags=integration,capacity -run '^TestActivityPolicyCoexistence$' -v ./internal/store
go test -tags=integration -run '^$' -bench 'Benchmark(ActivityIntervalBatch|RecordedPolicyProvenanceCapacity)$' -benchmem -count=10 ./internal/store
```

The router repository separately qualifies conntrack parsing/accounting,
Unbound dnstap, Alloy redaction/queue/rotation/disk pressure, firewall log-budget
exhaustion and actual rc.10 executable rollback. These tests generate local
metadata only. No physical load, fault, packet capture or forwarding benchmark
is part of this phase. Candidate-image boot checks and production acceptance
remain separate from application test results.
