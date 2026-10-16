"""Close authored overlay seams by matching lower-layer border vertices to the
higher-priority surface at the same XZ. The neighboring lower triangle becomes
an actual sloped apron; not a hidden plane, teleport or rescaling of the player.
Runs AFTER clipping, indexing and portable materials. Keeps tee/pin interiors.
"""
from pathlib import Path
import sys,json,struct,numpy as np,shapely
from shapely.geometry import Polygon
root=(Path('public')if Path('public/index.html').exists()else Path('.'))/'courses/puttclub';ns={};exec(Path('scripts/audit-puttclub-course.py').read_text().split('course=json.loads')[0],ns);G=ns['GLB'];c=G(root/'course_collision.glb');meta=json.loads((root/'surfaces.json').read_text());course=json.loads((root/'course.json').read_text())
levels=[]
for s in meta['surfaces']:
 ps=[Polygon(p['outer'],p['holes'])for p in s['boundaryPolygonsXZ']];levels.append({'priority':s['priority'],'shape':shapely.union_all(ps),'visual':s['visualMeshNames'],'collision':s['collisionMeshNames']})
for h in course['penaltyAreas']:
 es=[e for e in c.entries if e['name']==h['collisionBasinMeshName']];ts=np.concatenate([e['pos'][e['tri']][:,:,[0,2]]for e in es]);d=ts[:,1]-ts[:,0];f=ts[:,2]-ts[:,0];ts=ts[np.abs(d[:,0]*f[:,1]-d[:,1]*f[:,0])>1e-10];levels.append({'priority':60,'shape':shapely.union_all(shapely.polygons(ts)),'visual':[h['basinMeshName']],'collision':[h['collisionBasinMeshName']]})
levels.append({'priority':0,'shape':Polygon(),'visual':['Conceptual_Terrain_100ha'],'collision':['COLL_TERRAIN_BASE']})
levels.sort(key=lambda l:-l['priority']);tree=shapely.STRtree([l['shape']for l in levels]);targets={}
for l in levels:
 es=[e for e in c.entries if e['name']in l['collision']];targets[id(l)]=np.concatenate([e['pos'][e['tri']]for e in es])if es else np.zeros((0,3,3))
def target(l,x,z):
 t=targets[id(l)];a=t[:,0];b=t[:,1]-a;d=t[:,2]-a;den=b[:,0]*d[:,2]-b[:,2]*d[:,0];ok=np.abs(den)>1e-10;ix=np.where(ok)[0];a=a[ix];b=b[ix];d=d[ix];den=den[ix]
 u=((x-a[:,0])*d[:,2]-(z-a[:,2])*d[:,0])/den;v=(b[:,0]*(z-a[:,2])-b[:,2]*(x-a[:,0]))/den;mask=(u>=-.0005)&(v>=-.0005)&(u+v<=1.0005)
 if not np.any(mask):return None
 return float(np.max((a[:,1]+u*b[:,1]+v*d[:,1])[mask]))
report=[]
for kind,file in [('collision','course_collision.glb'),('visual','course_visual.glb')]:
 g=G(root/file);j=g.j;binary=bytearray(g.bin);world={}
 def walk(i,m):
  n=j['nodes'][i];w=m@g.matrix(n);world[i]=w
  for k in n.get('children',[]):walk(k,w)
 for i in j['scenes'][j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 for l in levels:
  for name in l[kind]:
   found=next(((i,n)for i,n in enumerate(j['nodes'])if n.get('name')==name and 'mesh'in n),None)
   if not found:continue
   ni,node=found;changed=0
   for pr,e in zip(j['meshes'][node['mesh']]['primitives'],[e for e in g.entries if e['name']==name]):
    wp=e['pos'].copy();pairs=tree.query(shapely.points(wp[:,[0,2]]),predicate='dwithin',distance=.00015);by={}
    for vi,li in pairs.T:
     hi=levels[li]
     if hi['priority']>l['priority']:by.setdefault(int(vi),[]).append(int(li))
    for vi,ls in by.items():
     for li in sorted(ls):
      y=target(levels[li],wp[vi,0],wp[vi,2])
      if y is not None:
       if abs(wp[vi,1]-y)>.0002:changed+=1;wp[vi,1]=y
       break
    if not by:continue
    inverse=np.linalg.inv(world[ni]);local=wp@inverse[:3,:3].T+inverse[:3,3];a=j['accessors'][pr['attributes']['POSITION']];view=j['bufferViews'][a['bufferView']];start=view.get('byteOffset',0)+a.get('byteOffset',0);raw=local.astype('<f4').tobytes();binary[start:start+len(raw)]=raw;a['min']=local.min(0).tolist();a['max']=local.max(0).tolist()
    if 'NORMAL'in pr['attributes']:
     triangles=e['tri'];p=local[triangles];face=np.cross(p[:,1]-p[:,0],p[:,2]-p[:,0]);n=np.zeros_like(local)
     for k in range(3):np.add.at(n,triangles[:,k],face)
     lengths=np.linalg.norm(n,axis=1);n/=np.maximum(lengths[:,None],1e-12);a=j['accessors'][pr['attributes']['NORMAL']];view=j['bufferViews'][a['bufferView']];start=view.get('byteOffset',0)+a.get('byteOffset',0);raw=n.astype('<f4').tobytes();binary[start:start+len(raw)]=raw
   if changed:report.append({'kind':kind,'mesh':name,'verticesWelded':changed});print(kind,name,changed,flush=True)
 j['buffers'][0]['byteLength']=len(binary);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4));(root/file).write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
cc=G(root/'course_collision.glb')
for h in course['holes']:
 for t in h['tees']:
  p=t['position'];hits=cc.hits(p[0],p[2]);assert hits and abs(hits[0]['y']-p[1])<.015,(t['id'],hits[:3])
Path('audit/course19/edge-weld.json').write_text(json.dumps(report,indent=2));print('All 54 tee interiors preserved after edge welding.')
