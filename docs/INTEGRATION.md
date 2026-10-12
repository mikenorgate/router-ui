# Install into a router image

The router build consumes `router-console_VERSION_linux_ARCH.tar.gz`, verifies its SHA-256 file and internal `SHA256SUMS`, and pins the version and contract versions in its image manifest. No live router configuration is applied by this repository's packaging script.

Install `bin/router-console` and `bin/router-console-publish` into the image's executable area, and `web/` into a read-only asset directory. Render the JSON configuration with the installed paths. The image does not need Node, npm, Go or Open Design at runtime. The SQLite driver is pure Go; artifacts are built with `CGO_ENABLED=0`.

Provision `router-console` as an unprivileged service user and `router-console-ingest` as the socket group. The example unit uses this group as its primary group. Add only approved producer users to that group, then authorize their exact numeric UIDs and source IDs in `producers`. File permissions are the first boundary; `SO_PEERCRED` and the per-source kind list are the second. Never authorize the web UID as a firewall-control caller or grant it `CAP_NET_ADMIN`.

Create a private durable state directory and a separate telemetry filesystem underneath encrypted persistent storage. The service preflight refuses a missing history directory or a history filesystem sharing the state device. Add `RequiresMountsFor` to the router-owned unit so a failed mount cannot fall back to writing bulk telemetry into ordinary `/var`. A preallocated ext4 image mounted from encrypted `/var` is one supported router implementation; its size, mounts, quota and ownership belong to the router build.

Before reserving the recommended 8 GiB, measure the installed appliance's actual `/var` capacity and free space, update/rollback reserve, journal limits and existing state growth. A fresh 64 GiB disk layout does not establish the installed `/var` size. If the profile does not fit, fail integration preflight and choose a reviewed smaller profile or offline migration. Never expand partitions or consume image-update capacity automatically. Qualify database/WAL and Prometheus compaction peaks against the hard filesystem ceiling.

Configure all management IP listeners explicitly, with matching browser origins. Use distinct hostnames/IPs for independent management sessions; host-only cookies do not isolate TCP ports on the same hostname. DNS names can be origins while listeners remain explicit IPs. Provide certificates covering every allowed origin and an independently usable local recovery address. The application reads TLS files on startup, SIGHUP and its periodic reload; the router handles issuance, renewal, atomic file replacement and private-key access. No CA signing credential belongs in the image. Admit only intended management networks through the router-owned firewall, including IPv6. Do not introduce routing into an isolated out-of-band network.

Provision recovery through the trusted appliance setup path, running as the application user so SQLite files have the correct ownership:

```sh
router-console -config /etc/router-console/config.json \
  -setup-user recovery -password-file /run/router-console-setup/password
```

The password file must be private, contain 12–1024 bytes, and be removed by the setup workflow afterward. There is no default account/password. Reprovisioning invalidates that account's sessions. Configure OIDC with an HTTPS issuer, client ID, runtime secret file if required, exact callback URI for each origin, explicit subject/group role mappings, and provider-supported extra scopes. Group names and identities are site inputs. The API has no recovery-password editor or provider-token storage.

Deploy one local Prometheus using the router's chosen pinned version, `--storage.tsdb.retention.time=90d`, `--storage.tsdb.retention.size=3GB` for the example profile, and a directory on the bounded telemetry filesystem. Bind it only to the console's reachable local namespace. Its deployment is router-owned; the console supplies the query interface and example configuration. The build renders scrape jobs and approved catalog queries, retaining the difference between host Linux, service-namespace and VPP counters. Existing Node Exporter and the host timer are extended as needed, never duplicated by this application. Each catalog entry supplies `query`, `label`, `unit`, `scope`, and an optional `timestamp_query` returning the actual measurement time as Unix seconds. Without that query, freshness is reported as unknown. Use the producer measurement timestamp for timer-written textfiles; a new scrape of an old file does not make the observation current.

Existing Alloy/journald pipelines can feed the local ingestion contract through a router-owned adapter with durable cursor acknowledgement. Local history must not depend on a remote Loki endpoint or its queues. Audit the existing Alloy restart/WAL behavior before using that branch for reliable local history. The application does not add a second journal collector or promise that copytruncate log rotation is lossless.

Suricata remains the existing detector. Its router-owned adapter publishes qualified events/flow metadata and records coverage limitations, including WAN-only observations after NAT and rotation gaps. Do not infer individual devices from an external WAN address. Conntrack/NAT and DNS lifecycle adapters, where supported, publish original/translated tuples and address bindings valid at event time. No second DPI engine is required.

The router's policy adapter supplies stable logical rule IDs, revisions, source references, installed snapshots, memberships, lifecycle and counter scope. Publish definitions and device applications as a complete v2 policy scope. Keep its read-only observation identity distinct from enforcement and operator identities. A router-owned bridge joins sanitized compilation provenance with independent kernel evidence; the web process never accesses enforcement sockets. Keep the approved enforcement cohort unchanged.

The Debian package installs binaries in `/usr/bin` and assets, schemas and
dependency notices in `/usr/share/router-console`. It contains no units,
maintainer scripts, installation configuration or credentials. The router owns
those resources. `console-release.json` binds source, toolchains, contracts,
artifact hashes and security reports. Verify it against a reviewed router-side
pin before extracting a package into the immutable image.

Scrape console health from the protected ingest socket's `GET /metrics`, through a router-owned Unix-socket adapter or existing textfile pipeline. The application does not expose unauthenticated metrics on the browser listeners. Source lag/loss, storage pressure, rejected ingest and sampling are available; certificate/listener state is also in the authenticated System API. Remote export remains optional.

The example unit's dependency direction is deliberate: routing, DHCP, DNS, firewall and boot activation must not `Require`, `BindTo` or wait for the console. Stopping it, corrupting its database or filling telemetry storage must leave forwarding working. Live rollout requires the router qualification checks in [VALIDATION.md](VALIDATION.md).
