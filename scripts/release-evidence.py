#!/usr/bin/env python3
"""Write public, hash-bound release metadata after successful offline builds/scans."""
import hashlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tarfile

root = Path(__file__).resolve().parents[1]
version = sys.argv[1]
out = root / 'dist'
commit = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, text=True).strip()
epoch = int(subprocess.check_output(['git', 'show', '-s', '--format=%ct', 'HEAD'], cwd=root))


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


artifacts = {}
package_files = {}
for arch in ('amd64', 'arm64'):
    deb_version = version.replace('-rc.', '~rc.')
    names = [f'router-console_{version}_linux_{arch}.tar.gz', f'router-console_{deb_version}_{arch}.deb']
    artifacts[arch] = {name: digest(out / name) for name in names}
    data = subprocess.check_output(['dpkg-deb', '--fsys-tarfile', str(out / names[1])])
    files = {}
    with tarfile.open(fileobj=io.BytesIO(data), mode='r:') as archive:
        for member in archive:
            name = member.name.removeprefix('./').rstrip('/') or '.'
            if member.isdir():
                continue
            if not member.isreg() or name in files or member.uid or member.gid:
                raise SystemExit('Unsafe package member')
            files[name] = {'sha256': hashlib.sha256(archive.extractfile(member).read()).hexdigest(),
                           'mode': member.mode, 'size': member.size}
    package_files[arch] = files
reports = {}
for name in ('source-security.txt', 'binary-amd64-security.txt', 'binary-arm64-security.txt', 'npm-security.json'):
    data = (out / name).read_text()
    if name.endswith('.txt') and 'No vulnerabilities found.' not in data:
        raise SystemExit('Security qualification missing: ' + name)
    if name == 'npm-security.json' and json.loads(data)['metadata']['vulnerabilities']['total']:
        raise SystemExit('Frontend vulnerability scan is not clean')
    reports[name] = digest(out / name)
value = {'schema': 1, 'version': version, 'tag': 'v' + version,
         'source_repository': 'https://github.com/mikenorgate/router-ui', 'source_commit': commit,
         'source_date_epoch': epoch, 'go_version': subprocess.check_output(['go', 'version'], text=True).strip(),
         'node_version': subprocess.check_output(['node', '--version'], text=True).strip(),
         'scanner': 'govulncheck-v1.8.0', 'ingestion_contracts': [1, 2], 'state_schema': 1, 'history_schema': 2,
         'inert_package': True, 'artifacts': artifacts, 'package_files': package_files, 'security': reports}
(out / 'console-release.json').write_text(json.dumps(value, sort_keys=True, indent=2) + '\n')
checksums = {p.name: digest(p) for p in out.iterdir() if p.is_file() and p.name != 'SHA256SUMS'}
(out / 'SHA256SUMS').write_text(''.join(f'{checksums[name]}  {name}\n' for name in sorted(checksums)))
