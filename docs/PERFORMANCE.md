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

The wall-clock acceptance test is separate from normal CI and race tests:

```sh
GOMAXPROCS=1 go test -tags=integration,capacity \
  -run '^TestCompletePolicyCapacityDeadline$' -v ./internal/store
```

Run that test only on a recorded native environment with the declared one-CPU and 2 GiB limits. It checks initial commit, shared rule revision and complete removal against an eight-second wall-clock limit. A timeout or missing resource isolation is not a pass.

For container isolation, compile a static test binary and run it inside an explicitly selected local Linux image. Mount an owned writable evidence directory and set `TMPDIR` there; the databases need more than a small container `/tmp` mount. Use no networking, no capabilities, a one-CPU quota, a 2 GiB memory ceiling, a 2 GiB memory-plus-swap ceiling and a bounded PID count. Record the image identity, Go version, CPU model, source identity and exact invocation with results.

For before/after comparisons, use the identical benchmark source, fixture, toolchain and limits on both revisions. Interleave baseline and candidate runs in alternating order. Keep at least ten samples of each and compare them with `benchstat`; retain time, bytes allocated and allocation counts. Small samples and noisy shared runners do not establish a regression or an improvement. Keep setup outside the timer and retain raw results rather than only a percentage.

The October 2026 validation also exercises the packaged application through UID-checked ingestion and authenticated HTTP requests while complete generations commit. Router-owned publisher benchmarks separately compare chunk construction and assert identical public wire bytes. Those integration probes belong to the router repository; this application does not depend on its collectors, deployment topology or benchmark runner.

## Recorded component measurements

Go 1.26.9 on an AMD Ryzen Threadripper 2950X, with one CPU and a 2 GiB hard memory ceiling, produced these interleaved ten-sample results against `v0.2.0-rc.2`:

| Initial 32,776-record complete commit | Baseline | Candidate |
| --- | ---: | ---: |
| Median operation time | 9.191 s | 3.596 s |
| Allocated bytes per operation | 585.8 MiB | 327.4 MiB |
| Allocations per operation | 8.595 million | 3.647 million |

`benchstat` reported p < 0.001 for all three comparisons. The time confidence intervals were wide: ±12% for baseline and ±49% for candidate. This shared-host result establishes a component improvement, not predictable worst-case router latency.

Three runs of 50 operations each measured median run averages of 0.69 ms for a 500-device page, 10.75 ms for one device's eight policies, 44.05 ms for its policy history and 15.02 ms for policy reads during retention. These are store-operation averages, not HTTP p95 measurements. Separate native wall-clock checks completed initial commit, shared rule revision and complete removal in 3.34, 5.50 and 4.46 seconds respectively, within their eight-second limit.

Component benchmarks do not qualify a signed router image, filesystem exhaustion behavior, physical forwarding or NIC/VPP performance. The deployment owner must perform those acceptance checks against the exact installed artifact.
