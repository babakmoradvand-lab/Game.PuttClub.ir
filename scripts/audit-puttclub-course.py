"""Read-only audit of the supplied PuttClub course. No Blender code is executed.
Usage: python scripts/audit-puttclub-course.py PATH_TO_EXTRACTED_COURSE
"""
import sys, json, struct, hashlib, collections, math
from pathlib import Path
import numpy as np

ROOT=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/puttclub-course/package/puttclub_luxury_resort_100ha')
OUT=Path('audit/puttclub-course'); OUT.mkdir(parents=True,exist_ok=True)
DT={5120:'i1',5121:'u1',5122:'<i2',5123:'<u2',5125:'<u4',5126:'<f4'}
NC={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
class GLB:
 def __init__(self,path):
  self.path=path; b=path.read_bytes(); magic,v,n=struct.unpack_from('<4sII',b); assert magic==b'glTF' and v==2 and n==len(b)
  off=12; self.bin=b''
  while off<len(b):
   size,typ=struct.unpack_from('<II',b,off);chunk=b[off+8:off+8+size];off+=8+size
   if typ==0x4e4f534a:self.j=json.loads(chunk)
   elif typ==0x004e4942:self.bin=chunk
  self.entries=[]
  def walk(i,parent):
   node=self.j['nodes'][i];world=parent@self.matrix(node)
   if 'mesh'in node:
    for p in self.j['meshes'][node['mesh']]['primitives']:
     assert p.get('mode',4)==4
     pos=self.acc(p['attributes']['POSITION']).astype(float);pos=pos@world[:3,:3].T+world[:3,3]
     indices=self.acc(p['indices']).reshape(-1) if 'indices'in p else np.arange(len(pos))
     self.entries.append({'name':node.get('name',str(i)),'mesh':self.j['meshes'][node['mesh']].get('name',''),'pos':pos,'tri':indices.reshape(-1,3),'material':p.get('material')})
   for k in node.get('children',[]):walk(k,world)
  for i in self.j['scenes'][self.j.get('scene',0)]['nodes']:walk(i,np.eye(4))
 def acc(self,i):
  a=self.j['accessors'][i];assert 'sparse'not in a
  bv=self.j['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);width=NC[a['type']];stride=bv.get('byteStride',width*dt.itemsize)
  return np.ndarray((a['count'],width),dtype=dt,buffer=self.bin,offset=bv.get('byteOffset',0)+a.get('byteOffset',0),strides=(stride,dt.itemsize)).copy()
 def matrix(self,n):
  if 'matrix'in n:return np.array(n['matrix']).reshape(4,4).T
  x,y,z,w=n.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
  m=np.eye(4);m[:3,:3]=r@np.diag(n.get('scale',[1,1,1]));m[:3,3]=n.get('translation',[0,0,0]);return m
 def stats(self):
  p=np.concatenate([e['pos']for e in self.entries]);j=self.j
  unique_vertices=sum(j['accessors'][pr['attributes']['POSITION']]['count']for m in j.get('meshes',[])for pr in m['primitives'])
  return {'bytes':self.path.stat().st_size,'sha256':hashlib.sha256(self.path.read_bytes()).hexdigest(),'generator':j['asset'].get('generator'), 'meshes':len(j.get('meshes',[])),'nodes':len(j.get('nodes',[])),'scenePrimitives':len(self.entries),'uniqueVertices':unique_vertices,'sceneTriangles':sum(len(e['tri'])for e in self.entries),'materials':len(j.get('materials',[])), 'images':len(j.get('images',[])), 'imageBytes':sum(j['bufferViews'][i['bufferView']]['byteLength']for i in j.get('images',[]) if 'bufferView'in i),'externalUris':[v['uri']for k in ['buffers','images']for v in j.get(k,[])if 'uri'in v and not v['uri'].startswith('data:')],'extensionsUsed':j.get('extensionsUsed',[]),'extensionsRequired':j.get('extensionsRequired',[]),'worldMin':p.min(0).tolist(),'worldMax':p.max(0).tolist(),'entryNames':[e['name']for e in self.entries]}
 def hits(self,x,z,names=None):
  result=[]
  for e in self.entries:
   if names is not None and e['name']not in names and e['mesh']not in names:continue
   pos=e['pos'];lo=pos.min(0);hi=pos.max(0)
   if not(lo[0]-1e-6<=x<=hi[0]+1e-6 and lo[2]-1e-6<=z<=hi[2]+1e-6):continue
   t=pos[e['tri']];a=t[:,0];b=t[:,1]-a;c=t[:,2]-a
   det=b[:,0]*c[:,2]-b[:,2]*c[:,0];ok=np.abs(det)>1e-12
   ix=np.where(ok)[0];d=det[ix];aa=a[ix];bb=b[ix];cc=c[ix]
   u=((x-aa[:,0])*cc[:,2]-(z-aa[:,2])*cc[:,0])/d
   v=(bb[:,0]*(z-aa[:,2])-bb[:,2]*(x-aa[:,0]))/d
   mask=(u>=-1e-7)&(v>=-1e-7)&(u+v<=1+1e-7)
   for y in (aa[:,1]+u*bb[:,1]+v*cc[:,1])[mask]:result.append({'name':e['name'],'y':float(y)})
  return sorted(result,key=lambda x:-x['y'])

def inside(x,z,poly):
 result=False
 for (a,b),(c,d)in zip(poly,poly[1:]+poly[:1]):
  if (b>z)!=(d>z) and x<(c-a)*(z-b)/(d-b)+a: result=not result
 return result

def area(p):return abs(sum(a*d-c*b for (a,b),(c,d)in zip(p,p[1:]+p[:1])))/2

course=json.loads((ROOT/'course.json').read_text());surfaces=json.loads((ROOT/'surfaces.json').read_text());trees=json.loads((ROOT/'trees.json').read_text());dz=json.loads((ROOT/'drop_zones.json').read_text())
visual=GLB(ROOT/'course_visual.glb');collision=GLB(ROOT/'course_collision.glb')
models={'visual':visual.stats(),'collision':collision.stats()};tree_models={t['typeId']:GLB(ROOT/t['assetPath'])for t in trees['treeTypes']};tree_stats={k:v.stats()for k,v in tree_models.items()}
for k,v in models.items():print(k,json.dumps({a:b for a,b in v.items()if a!='entryNames'}),flush=True)
for k,v in tree_stats.items():print(k,json.dumps({a:b for a,b in v.items()if a!='entryNames'}),flush=True)
visual_names={e[k] for e in visual.entries for k in ['name','mesh']};collision_names={e[k]for e in collision.entries for k in ['name','mesh']}
refs=[]
for s in surfaces['surfaces']:
 for field,names in [('visualMeshNames',visual_names),('collisionMeshNames',collision_names)]:
  for name in s.get(field,[]):
   if name not in names:refs.append({'surface':s['id'],'field':field,'missing':name})
for p in course['penaltyAreas']:
 for field,names in [('waterMeshName',visual_names),('basinMeshName',visual_names),('collisionBasinMeshName',collision_names)]:
  if p.get(field)and p[field]not in names:refs.append({'hazard':p['id'],'field':field,'missing':p[field]})

def hazards_at(p):
 return [h['id']for h in course['penaltyAreas']if inside(p[0],p[2],h['boundaryPolygonXZ']) and not any(inside(p[0],p[2],q)for q in h.get('exceptionIslandsXZ',[]))]

checks=[];hole_rows=[];cup_rows=[]
for h in course['holes']:
 pin=next(p for p in h['pins']if p.get('isDefault'));p=pin['position'];green=next(s for s in surfaces['surfaces']if s['id']==f"SURF_H{h['number']:02d}_GREEN")
 hole_rows.append({'hole':h['number'],'par':h['par'],'blueDistanceM':h['tees'][0]['distanceToPinM'],'directHorizontalM':math.hypot(p[0]-h['tees'][0]['position'][0],p[2]-h['tees'][0]['position'][2])})
 for obj,kind,mesh_names in [(pin,'pin',green['collisionMeshNames'])]+[(t,'tee', [f"COLL_TEE_{h['number']:02d}"])for t in h['tees']]:
  pp=obj['position'];hits=collision.hits(pp[0],pp[2],mesh_names);vhits=visual.hits(pp[0],pp[2],green['visualMeshNames'] if kind=='pin'else [f"Tee_{h['number']:02d}_Turf_GG02"])
  delta=None if not hits else pp[1]-min(hits,key=lambda x:abs(x['y']-pp[1]))['y']
  checks.append({'id':obj['id'],'kind':kind,'position':pp,'collisionHits':hits,'visualHits':vhits,'deltaY':delta,'insideExpectedSurface':inside(pp[0],pp[2],green['boundaryPolygonXZ'] if kind=='pin'else next(s for s in surfaces['surfaces']if s['id']==f"SURF_H{h['number']:02d}_TEE")['boundaryPolygonXZ']),'hazards':hazards_at(pp)})
 for offset in [0,.03,.06,.12]:
  hits=collision.hits(p[0]+offset,p[2],[h['green']['collisionMeshName']]);cup_rows.append({'hole':h['number'],'offsetX':offset,'hits':hits,'pinY':p[1]})
 print('checked hole',h['number'],flush=True)

drops=[]
for d in dz['dropZones']:
 p=d['center'];hits=collision.hits(p[0],p[2]);drops.append({'id':d['id'],'center':p,'hazards':hazards_at(p),'collisionHits':hits,'deltaFromHighest':p[1]-hits[0]['y'] if hits else None})
water=[]
for h in course['penaltyAreas']:
 entries=[e for e in visual.entries if h['waterMeshName']in [e['name'],e['mesh']]]
 p=np.concatenate([e['pos']for e in entries])if entries else None
 water.append({'id':h['id'],'expectedY':h['waterLevelY'],'visualMinY':None if p is None else float(p[:,1].min()),'visualMaxY':None if p is None else float(p[:,1].max()),'waterPolygonAreaM2':area(h['waterPolygonXZ']),'boundaryPolygonAreaM2':area(h['boundaryPolygonXZ']),'sameWaterAndBoundary':h['waterPolygonXZ']==h['boundaryPolygonXZ']})

# Geometry and instanced workload estimates; NOT measured GPU performance.
counts=collections.Counter(t['typeId']for t in trees['instances']);treework=sum(counts[k]*v['sceneTriangles']for k,v in tree_stats.items());treebounds=[]
for t in trees['treeTypes']:
 st=tree_stats[t['typeId']];treebounds.append({'typeId':t['typeId'],'metadataHeightM':t['heightM'],'meshExtentY':st['worldMax'][1]-st['worldMin'][1],'baseY':st['worldMin'][1],'centerXZ':[(st['worldMax'][i]+st['worldMin'][i])/2 for i in [0,2]],'trunkMetadata':t['trunkCollider']})
# Flag duplicate geometry independent of names, and exact positions outside course bounds.
def geom_hash(m):
 a=hashlib.sha256()
 for e in m.entries:a.update(e['pos'].round(5).astype('<f4').tobytes());a.update(e['tri'].astype('<u4').tobytes())
 return a.hexdigest()
geo_hash={k:geom_hash(m)for k,m in tree_models.items()}
file_info=[]
for f in sorted(ROOT.rglob('*')):
 if f.is_file():file_info.append({'name':str(f.relative_to(ROOT)),'bytes':f.stat().st_size,'sha256':hashlib.sha256(f.read_bytes()).hexdigest()})
summary={'displayName':'زمین باشگاه پات کلاب','originalName':course['name'],'courseId':course['id'],'blendHeader':(ROOT/'course.blend').read_bytes()[:12].decode('ascii',errors='replace'),'files':file_info,'models':models,'treeModels':tree_stats,'missingMeshReferences':refs,'surfaceCounts':dict(collections.Counter(s['type']for s in surfaces['surfaces'])),'holeCount':len(course['holes']),'parSum':sum(h['par']for h in course['holes']),'strokeIndices':[h['strokeIndex']for h in course['holes']],'blueDistanceSumM':sum(h['tees'][0]['distanceToPinM']for h in course['holes']),'holes':hole_rows,'positionChecks':checks,'cupChecks':cup_rows,'dropZoneChecks':drops,'waterChecks':water,'treeCounts':dict(counts),'treeCountsMatchDeclared':dict(counts)==trees['speciesCounts'] and sum(counts.values())==trees['instanceCount'],'treeBounds':treebounds,'treeGeometryHashes':geo_hash,'allTreesWithoutCullingTriangleEstimate':treework,'treesInsidePlayableBoundary':sum(inside(t['position'][0],t['position'][2],course['outOfBounds']['playableBoundaryPolygonXZ'])for t in trees['instances']),'playableAreaM2':area(course['outOfBounds']['playableBoundaryPolygonXZ']),'pinRayInterpretation':'Pin metadata describes the cup rim. A vertical ray exactly at the pin reaches the recessed cup floor, so its approximately 0.108m delta is not a grounding error. Check rim offsets separately.', 'integrationTested':False,'gameFilesModified':False}
(OUT/'analysis.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
print('SAVED',OUT/'analysis.json');print('missing refs',refs);print('TREE WORK',treework,'geo hashes',geo_hash);print('POSITION ISSUES',[x for x in checks if x['deltaY']is None or (x['kind']=='tee' and abs(x['deltaY'])>.02) or x['hazards'] or not x['insideExpectedSurface']]);print('DROPS',drops)

# Independent diagnostic map generated from supplied numeric data, not an author render.
import matplotlib;matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.patches import Polygon
fig,ax=plt.subplots(figsize=(11,11),facecolor='#f3f1e8');ax.set_facecolor('#d4dfbc')
colors={'heavy_rough':'#7e9968','rough':'#b6c98d','fringe':'#78a752','fairway':'#90b961','tee':'#eee4bb','green':'#347b51','bunker':'#e7cc91'}
for s in sorted(surfaces['surfaces'],key=lambda s:s['priority']):
 p=np.array(s['boundaryPolygonXZ']);ax.add_patch(Polygon(np.column_stack((p[:,0],-p[:,1])),facecolor=colors[s['type']],edgecolor='#506d45',linewidth=.35,alpha=.8))
for h in course['penaltyAreas']:
 p=np.array(h['boundaryPolygonXZ']);ax.add_patch(Polygon(np.column_stack((p[:,0],-p[:,1])),facecolor='#62abc3',edgecolor='#bd5d50',linewidth=.8,alpha=.8))
 for q in h.get('exceptionIslandsXZ',[]):
  p=np.array(q);ax.add_patch(Polygon(np.column_stack((p[:,0],-p[:,1])),facecolor='#b6c98d'))
for h in course['holes']:
 t=h['tees'][0]['position'];p=h['pins'][0]['position'];ax.plot([t[0],p[0]],[-t[2],-p[2]],color='#202f28',lw=.7,alpha=.65);ax.scatter([t[0]],[-t[2]],color='#3469af',s=12);ax.scatter([p[0]],[-p[2]],color='#ae4840',s=12);ax.text(p[0]+4,-p[2]+4,str(h['number']),fontsize=9,weight='bold')
for d in dz['dropZones']:
 p=d['center'];ax.scatter(p[0],-p[2],color='#f0a100',marker='s',s=32)
ax.set(xlim=(-520,520),ylim=(-520,520),xlabel='Game X (m)',ylabel='-Game Z (m)',title='PuttClub | Package diagnostic map\nBlue: tee  /  Red: pin  /  Orange square: drop zone\nWater/legal boundaries are plotted exactly as supplied')
ax.set_aspect('equal');ax.grid(alpha=.15);fig.tight_layout();fig.savefig(OUT/'diagnostic-map.png',dpi=160);plt.close(fig)
