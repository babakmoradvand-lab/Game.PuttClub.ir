"""Add original master-terrain color to source nature GLB, for H01 sparse rough.
Run after prepare-native and transfer-fields. Never changes positions/indices/UVs.
Requires the private authored-field extraction under .cache/quality22.
"""
from pathlib import Path
import json,struct,numpy as np
ns={}
exec(Path('scripts/quality22-transfer-fields.py').read_text().split("root=Path('public/courses/puttclub')")[0],ns)
file=Path('public/courses/puttclub/native/nature.glb');g=ns['GLB'](file);j=g.j;binary=bytearray(g.bin);changed=False
entries={}
for e in g.entries:entries.setdefault(e['name'],[]).append(e)
for node in j['nodes']:
 if 'mesh' not in node:continue
 for pi,p in enumerate(j['meshes'][node['mesh']]['primitives']):
  if '_PC_BASE_COLOR' in p['attributes']:continue
  a=ns['masterSample'](entries[node['name']][pi]['pos']).astype('<f4');binary.extend(b'\0'*(-len(binary)%4));vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes());j['accessors'].append({'bufferView':vi,'componentType':5126,'count':len(a),'type':'VEC3'});p['attributes']['_PC_BASE_COLOR']=len(j['accessors'])-1;changed=True
if changed:
 j['buffers'][0]['byteLength']=len(binary);s=json.dumps(j,separators=(',',':')).encode();s+=b' '*(-len(s)%4);binary.extend(b'\0'*(-len(binary)%4));file.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(s)+len(binary))+struct.pack('<II',len(s),0x4e4f534a)+s+struct.pack('<II',len(binary),0x004e4942)+binary)
print('Nature source base color:', 'appended' if changed else 'already present')
