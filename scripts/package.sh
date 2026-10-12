#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release_version="${1:?usage: bash scripts/package.sh VERSION [amd64|arm64]}"
release_arch="${2:-amd64}"
case "$release_version" in *[!a-zA-Z0-9._-]*|'') echo 'invalid version' >&2; exit 2;; esac
case "$release_arch" in amd64|arm64) ;; *) echo 'unsupported architecture' >&2; exit 2;; esac
test -f web/dist/index.html || { echo 'build web assets first' >&2; exit 1; }
export SOURCE_DATE_EPOCH="${SOURCE_DATE_EPOCH:-$(git log -1 --format=%ct)}"
release_commit="${SOURCE_COMMIT:-$(git rev-parse HEAD)}"
export TZ=UTC LC_ALL=C
release_stage="$(mktemp -d)"
trap 'rm -rf "$release_stage"' EXIT
mkdir -p "$release_stage/tar/bin" "$release_stage/tar/web" "$release_stage/tar/integration" "$release_stage/tar/schemas" dist
CGO_ENABLED=0 GOOS=linux GOARCH="$release_arch" go build -buildvcs=false -trimpath -ldflags "-w -X main.version=$release_version" -o "$release_stage/tar/bin/router-console" ./cmd/router-console
CGO_ENABLED=0 GOOS=linux GOARCH="$release_arch" go build -buildvcs=false -trimpath -ldflags '-w' -o "$release_stage/tar/bin/router-console-publish" ./cmd/router-console-publish
cp -R web/dist/. "$release_stage/tar/web/"
cp deploy/* docs/INTEGRATION.md docs/INGESTION.md "$release_stage/tar/integration/"
cp schemas/*.json "$release_stage/tar/schemas/"
cp LICENSE "$release_stage/tar/"
python3 scripts/licenses.py "$release_stage/tar"
mkdir -p "$release_stage/tar/third_party/fonts"
cp design/fonts/*OFL* "$release_stage/tar/third_party/fonts/"
python3 - "$release_stage/tar/manifest.json" "$release_version" "$release_arch" "$release_commit" "$(go version)" "$(node --version)" <<'PY'
import json,sys
from pathlib import Path
Path(sys.argv[1]).write_text(json.dumps({'version':sys.argv[2],'os':'linux','arch':sys.argv[3],
 'source_repository':'https://github.com/mikenorgate/router-ui','source_commit':sys.argv[4],
 'go_version':sys.argv[5],'node_version':sys.argv[6],
 'ingestion_contract':2,'supported_ingestion_contracts':[1,2],'state_schema':1,'history_schema':2},sort_keys=True)+'\n')
PY
(cd "$release_stage/tar" && find . -type f ! -name SHA256SUMS -print0 | sort -z | xargs -0 sha256sum > SHA256SUMS)
tar --sort=name --mtime="@$SOURCE_DATE_EPOCH" --owner=0 --group=0 --numeric-owner -C "$release_stage/tar" -cf - . | gzip -n -9 > "dist/router-console_${release_version}_linux_${release_arch}.tar.gz"
release_deb_version="${release_version/-rc./~rc.}"
mkdir -p "$release_stage/deb/DEBIAN" "$release_stage/deb/usr/bin" "$release_stage/deb/usr/share/router-console" "$release_stage/deb/usr/share/doc/router-console"
cp "$release_stage/tar/bin/"* "$release_stage/deb/usr/bin/"
cp -R "$release_stage/tar/web" "$release_stage/tar/schemas" "$release_stage/tar/third_party" "$release_stage/deb/usr/share/router-console/"
cp "$release_stage/tar/manifest.json" "$release_stage/deb/usr/share/router-console/"
cp LICENSE "$release_stage/deb/usr/share/doc/router-console/copyright"
cat > "$release_stage/deb/DEBIAN/control" <<CONTROL
Package: router-console
Version: $release_deb_version
Architecture: $release_arch
Maintainer: Michael Norgate
Depends: ca-certificates
Section: net
Priority: optional
Description: Standalone read-only network observatory
 Locally hosted console, APIs and bounded history for immutable routers.
CONTROL
find "$release_stage/deb" -print0 | xargs -0 touch --no-dereference --date="@$SOURCE_DATE_EPOCH"
dpkg-deb --root-owner-group --uniform-compression -Zgzip -z9 --build "$release_stage/deb" "dist/router-console_${release_deb_version}_${release_arch}.deb" >/dev/null
sha256sum "dist/router-console_${release_version}_linux_${release_arch}.tar.gz" "dist/router-console_${release_deb_version}_${release_arch}.deb" > "dist/router-console_${release_version}_${release_arch}.sha256"
printf '%s\n' "dist/router-console_${release_version}_linux_${release_arch}.tar.gz" "dist/router-console_${release_deb_version}_${release_arch}.deb"
