# Router Console

A standalone observatory installed into an immutable Linux router. The React/TypeScript interface and Go API run locally, with SQLite history and an optional local Prometheus store. Open Design is used to author pages; it is not a runtime dependency.

The console explains devices, traffic and firewall provenance. It separates installed rules, device applicability and observed matches. Missing observations, unknown provenance, stale measurements and sampling remain visible. Console aliases and notes do not change DHCP, DNS or firewall policy.

This repository owns the application, APIs, ingestion contract, storage and release artifact. The router repository owns the OS, core services and the producers that supply observations. See [integration](docs/INTEGRATION.md) before adding this artifact to a router image.

## Develop

Requires Go 1.26 and Node 24. Build the frontend, then run an isolated fixture appliance:

```sh
npm --prefix web ci
npm --prefix web run build
python3 scripts/dev.py
```

The script creates disposable state, provisions a random recovery password and serves `http://127.0.0.1:8088`. It prints that temporary credential locally. Fixture mode only binds loopback and marks observations as synthetic. The frontend also has an explicit `?demo=1` design preview; failed production requests never select demo data.

```sh
go test -race -tags=integration ./...
go vet -tags=integration ./...
golangci-lint run
npm --prefix web test
npm --prefix web run build
bash scripts/package.sh 0.2.0-rc.4 amd64
```

Packages contain binaries, local web assets, checksums, schemas/version metadata and integration examples. They do not install or activate router services. Use `deploy/config.example.json` as an installation input; all addresses, source UIDs, credentials and measurement queries must be supplied by the router build.

## Access

OIDC uses authorization code with PKCE, validated ID tokens, explicit subject/group role mappings, and a callback for each allowed management origin. The backend retains no provider tokens. Local recovery uses a provisioned Argon2id password with no default credential. Production sessions use host-only Secure/HttpOnly cookies, fixed expiry, CSRF protection and API permissions.

Viewer reads inventory and summaries. Operator can inspect traffic/DNS, export bounded observations, and annotate devices. Administrator can inspect the console audit, revoke sessions, and reduce retention through the management APIs within installation ceilings. Trusted appliance setup provisions recovery accounts; immutable configuration owns OIDC role mappings and storage ceilings. Console authentication never grants network access.

## Design and contracts

- [Core systems](docs/CORE_SYSTEMS.md)
- [Router integration](docs/INTEGRATION.md)
- [Ingestion and evidence](docs/INGESTION.md)
- [Validation and release qualification](docs/VALIDATION.md)
- [Product direction](docs/PRODUCT_PLAN.md)
- [Open Design workflow](docs/OPEN_DESIGN.md)

The attached Open Design system is `user:router-console-design-system`; its exported package is in `design/`. Runtime fonts and assets are bundled locally.
