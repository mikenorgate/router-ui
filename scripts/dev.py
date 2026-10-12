#!/usr/bin/env python3
"""Start an explicit local fixture appliance without router services or default credentials."""
import json
import os
from pathlib import Path
import secrets
import subprocess
import tempfile

root=Path(__file__).resolve().parent.parent
work=Path(tempfile.mkdtemp(prefix='router-console-dev-'))
config=json.loads((root/'deploy/config.example.json').read_text())
config.update(listen=['127.0.0.1:8088'],origins=['http://127.0.0.1:8088'],certificates=[],state_dir=str(work/'state'),history_dir=str(work/'history'),web_dir=str(root/'web/dist'),ingest_socket=str(work/'ingest.sock'),fixture=True,prometheus_url='',producers=[dict(id='fixture',uid=os.getuid(),kinds=['device','flow','dns','policy','event','network'])])
path=work/'config.json'
path.write_text(json.dumps(config))
password=secrets.token_urlsafe(20)
credential=work/'setup-password'
credential.write_text(password)
credential.chmod(0o600)
subprocess.run(['go','build','-o',str(work/'router-console'),'./cmd/router-console'],cwd=root,check=True)
subprocess.run([str(work/'router-console'),'-config',str(path),'-setup-user','recovery','-password-file',str(credential)],check=True)
credential.unlink()
print(f'Fixture console: http://127.0.0.1:8088\nUser: recovery\nTemporary password: {password}\nDisposable state: {work}',flush=True)
try:
    subprocess.run([str(work/'router-console'),'-config',str(path)],check=True)
except KeyboardInterrupt:
    pass
