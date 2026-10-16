"""Index patched GLB triangle corners; preserve UV/normal/material seams (1e-6 key)."""
from pathlib import Path
import sys,json,struct,numpy as np
SRC=Path(sys.argv[1])
ns={};exec(Path('scripts/audit-puttclub-course.py').read_text().split('course=json.loads')[0],ns);g=ns['GLB'](SRC);j=g.j;b=bytearray(g.bin);before=SRC.stat().st_size
for m in j['meshes']:
 for p in m['primitives']:
  if 'indices'in p:continue
  keys=list(p['attributes']);arrays=[g.acc(p['attributes'][k])for k in keys];counts=[a.shape[1]for a in arrays];flat=np.concatenate(arrays,axis=1);_,ids,inv=np.unique(np.round(flat,6),axis=0,return_index=True,return_inverse=True)
  if len(ids)>=len(flat)*.94:continue
  for k,a in zip(keys,arrays):
   a=a[ids].astype('<f4');b.extend(b'\0'*((-len(b))%4));view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':a.nbytes});b.extend(a.tobytes());old=dict(j['accessors'][p['attributes'][k]]);old.update(bufferView=view,byteOffset=0,count=len(a),componentType=5126);old.pop('normalized',None)
   if 'min'in old:old['min']=a.min(0).tolist();old['max']=a.max(0).tolist()
   j['accessors'].append(old);p['attributes'][k]=len(j['accessors'])-1
  a=inv.astype('<u4');b.extend(b'\0'*((-len(b))%4));view=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(b),'byteLength':a.nbytes});b.extend(a.tobytes());j['accessors'].append({'bufferView':view,'componentType':5125,'count':len(a),'type':'SCALAR'});p['indices']=len(j['accessors'])-1
used=sorted({a for m in j['meshes']for p in m['primitives']for a in list(p['attributes'].values())+[p.get('indices')]if a is not None});am={old:i for i,old in enumerate(used)};j['accessors']=[j['accessors'][i]for i in used]
for m in j['meshes']:
 for p in m['primitives']:
  p['attributes']={k:am[a]for k,a in p['attributes'].items()}
  if 'indices'in p:p['indices']=am[p['indices']]
views=sorted({a['bufferView']for a in j['accessors']}|{im['bufferView']for im in j.get('images',[])if 'bufferView'in im});vm={old:i for i,old in enumerate(views)};new=bytearray();vs=[]
for i in views:
 view=dict(j['bufferViews'][i]);start=view.get('byteOffset',0);chunk=b[start:start+view['byteLength']];new.extend(b'\0'*((-len(new))%4));view['byteOffset']=len(new);view['buffer']=0;new.extend(chunk);vs.append(view)
for a in j['accessors']:a['bufferView']=vm[a['bufferView']]
for im in j.get('images',[]):
 if 'bufferView'in im:im['bufferView']=vm[im['bufferView']]
j['bufferViews']=vs;j['buffers']=[{'byteLength':len(new)}];js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);new.extend(b'\0'*((-len(new))%4));data=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(new))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(new),0x004e4942)+new;SRC.write_bytes(data)
print(SRC,before,'->',len(data));gg=ns['GLB'](SRC);assert sum(len(e['tri'])for e in g.entries)==sum(len(e['tri'])for e in gg.entries)
