#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release_version="${1:?usage: bash scripts/package.sh VERSION [amd64|arm64]}"
release_arch="${2:-amd64}"
case "$release_version" in *[!a-zA-Z0-9._-]*|'') echo 'invalid version' >&2; exit 2;; esac
case "$release_arch" in amd64|arm64) ;; *) echo 'unsupported architecture' >&2; exit 2;; esac
test -f web/dist/index.html || { echo 'build web assets first: npm --prefix web ci && npm --prefix web run build' >&2; exit 1; }
release_stage="$(mktemp -d)"
trap 'rm -rf "$release_stage"' EXIT
mkdir -p "$release_stage/bin" "$release_stage/web" "$release_stage/integration" "$release_stage/schemas" dist
CGO_ENABLED=0 GOOS=linux GOARCH="$release_arch" go build -trimpath -ldflags "-s -w -X main.version=$release_version" -o "$release_stage/bin/router-console" ./cmd/router-console
CGO_ENABLED=0 GOOS=linux GOARCH="$release_arch" go build -trimpath -ldflags '-s -w' -o "$release_stage/bin/router-console-publish" ./cmd/router-console-publish
cp -R web/dist/. "$release_stage/web/"
cp deploy/* "$release_stage/integration/"
cp schemas/*.json "$release_stage/schemas/"
cp docs/INTEGRATION.md docs/INGESTION.md "$release_stage/integration/"
python3 scripts/licenses.py "$release_stage"
printf '{"version":"%s","os":"linux","arch":"%s","ingestion_contract":1,"state_schema":1,"history_schema":1}\n' "$release_version" "$release_arch" > "$release_stage/manifest.json"
(cd "$release_stage" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar -C "$release_stage" -czf "dist/router-console_${release_version}_linux_${release_arch}.tar.gz" .
sha256sum "dist/router-console_${release_version}_linux_${release_arch}.tar.gz" > "dist/router-console_${release_version}_linux_${release_arch}.tar.gz.sha256"
echo "dist/router-console_${release_version}_linux_${release_arch}.tar.gz"
