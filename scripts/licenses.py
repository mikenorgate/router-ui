#!/usr/bin/env python3
"""Collect dependency versions and license notices into a release staging directory."""
import json
from pathlib import Path
import shutil
import subprocess
import sys

root=Path(__file__).resolve().parent.parent
out=Path(sys.argv[1])/'third_party'
out.mkdir(parents=True,exist_ok=True)
decoder=json.JSONDecoder()
raw=subprocess.check_output(['go','list','-deps','-json','./cmd/...'],cwd=root,text=True)
modules=[]
seen=set()
while raw.strip():
    package,end=decoder.raw_decode(raw.lstrip())
    raw=raw.lstrip()[end:]
    item=package.get('Module')
    if not item or item.get('Main'):continue
    key=(item['Path'],item.get('Version','local'))
    if key in seen:continue
    seen.add(key)
    modules.append({k:item[k] for k in ['Path','Version'] if k in item})
    folder=Path(item['Dir'])
    dest=out/'go'/item['Path']/item.get('Version','local')
    for file in folder.iterdir():
        if file.is_file() and file.name.upper().startswith(('LICENSE','COPYING','NOTICE','AUTHORS')):
            dest.mkdir(parents=True,exist_ok=True)
            shutil.copy2(file,dest/file.name)
packages=[]
for manifest in sorted((root/'web/node_modules').rglob('package.json')):
    if '.cache' in manifest.parts:continue
    try: item=json.loads(manifest.read_text())
    except (OSError,ValueError):continue
    if not item.get('name') or not item.get('version'):continue
    packages.append({'name':item['name'],'version':item['version'],'license':item.get('license','see package notice')})
    dest=out/'npm'/item['name']/item['version']
    for file in manifest.parent.iterdir():
        if file.is_file() and file.name.upper().startswith(('LICENSE','COPYING','NOTICE')):
            dest.mkdir(parents=True,exist_ok=True)
            shutil.copy2(file,dest/file.name)
(out/'components.json').write_text(json.dumps({'go':sorted(modules,key=lambda x:(x['Path'],x.get('Version',''))),'npm':sorted(packages,key=lambda x:(x['name'],x['version']))},indent=2)+'\n')
