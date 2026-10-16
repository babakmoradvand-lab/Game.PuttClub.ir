"""Rehash the canonical runtime inventory after runtime edits, before publishing.
Usage: python tests/build-runtime-manifest.py [version matching index.html meta]
Add any new runtime asset URL to release.json's assets inventory first.
"""
from pathlib import Path
from datetime import datetime, timezone
import re,hashlib,json,sys
root=Path('public') if Path('public/index.html').exists() else Path('.')
html_version=re.search(r'<meta name="putt-release" content="([^"]+)"', (root/'index.html').read_text()).group(1)
version=sys.argv[1] if len(sys.argv)>1 else html_version
assert version==html_version, 'HTML version must match the release version (avoid mixed-build reloads)'
previous=json.loads((root/'release.json').read_text())
paths={a['url'][2:].split('?')[0] for a in previous['assets']}
assets=[]
for path in sorted(paths):
 data=(root/path).read_bytes()
 assets.append({'url':'./'+path,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
release={'version':version,'createdAt':datetime.now(timezone.utc).isoformat(timespec='milliseconds').replace('+00:00','Z'),'assets':assets}
(root/'release.json').write_text(json.dumps(release,separators=(',',':'))+'\n')
print(f'{version}: {len(assets)} verified assets, {sum(a["bytes"] for a in assets)/1048576:.2f} MB; descriptor {len((root/"release.json").read_bytes())} bytes')
