#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist
release_version="${1:?usage: bash scripts/security.sh VERSION}"
release_deb_version="${release_version/-rc./~rc.}"
go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 ./... > dist/source-security.txt
for release_arch in amd64 arm64; do
  release_binary="$(mktemp)"
  : > "dist/binary-${release_arch}-security.txt"
  for release_command in router-console router-console-publish; do
    dpkg-deb --fsys-tarfile "dist/router-console_${release_deb_version}_${release_arch}.deb" | tar -xOf - "./usr/bin/$release_command" > "$release_binary"
    printf 'Command: %s\n' "$release_command" >> "dist/binary-${release_arch}-security.txt"
    go run golang.org/x/vuln/cmd/govulncheck@v1.8.0 -mode=binary "$release_binary" >> "dist/binary-${release_arch}-security.txt"
  done
  rm -f "$release_binary"
done
(cd web && npm audit --omit=dev --json) > dist/npm-security.json
