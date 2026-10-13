"""Run the release notice collector against disposable dependency trees."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

class ReleaseNoticeTests(unittest.TestCase):
    def test_cache_ancestor_and_linked_dependencies_preserve_notices(self):
        with tempfile.TemporaryDirectory() as temporary:
            parent=Path(temporary)
            source=parent/'.cache'/'release'
            (source/'scripts').mkdir(parents=True)
            (source/'web').mkdir()
            script=source/'scripts/licenses.py'
            shutil.copyfile(Path(__file__).with_name('licenses.py'),script)
            dependencies=parent/'dependencies'
            package=dependencies/'react'
            package.mkdir(parents=True)
            (package/'package.json').write_text(json.dumps({'name':'react','version':'19.3.0','license':'MIT'}))
            (package/'LICENSE').write_text('Synthetic release notice fixture')
            (source/'web/node_modules').symlink_to(dependencies,target_is_directory=True)
            (source/'web/package.json').write_text(json.dumps({'dependencies':{'react':'19.3.0'}}))
            tools=parent/'bin'; tools.mkdir()
            go=tools/'go'; go.write_text("#!/usr/bin/env python3\nprint('{}')\n"); go.chmod(0o755)
            env={**os.environ,'PATH':str(tools)+os.pathsep+os.environ['PATH']}
            output=parent/'output'
            result=subprocess.run([sys.executable,str(script),str(output)],env=env,capture_output=True,text=True,timeout=10)
            self.assertEqual(result.returncode,0,result.stderr)
            self.assertEqual((output/'third_party/npm/react/19.3.0/LICENSE').read_text(),'Synthetic release notice fixture')
            self.assertEqual(json.loads((output/'third_party/components.json').read_text())['npm'][0]['name'],'react')
            (package/'package.json').unlink()
            result=subprocess.run([sys.executable,str(script),str(parent/'missing')],env=env,capture_output=True,text=True,timeout=10)
            self.assertNotEqual(result.returncode,0,'missing runtime dependency notice was silently accepted')

if __name__=='__main__':
    unittest.main()
