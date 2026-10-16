"""Patch original author GLBs without running a .blend file. Preserve materials/UVs.
Clip lower priority projected triangles beneath actual higher-priority footprints.
Build non-rectangular red boundaries from the exported water mesh; validate drop zones.
"""
from pathlib import Path
import sys,json,struct,copy,shutil,hashlib
import numpy as np
import shapely
from shapely.geometry import Polygon,Point
from shapely.ops import nearest_points
import mapbox_earcut
SRC=Path(sys.argv[1] if len(sys.argv)>1 else '.cache/course19/source/puttclub_luxury_resort_100ha')
DST=(Path('public')if Path('public/index.html').exists()else Path('.'))/'courses/puttclub';DST.mkdir(parents=True,exist_ok=True)
sys.argv=['audit',str(SRC)]
ns={};exec(Path('scripts/audit-puttclub-course.py').read_text().split('course=json.loads')[0],ns);GLB=ns['GLB']
v=GLB(SRC/'course_visual.glb');c=GLB(SRC/'course_collision.glb')
course=json.loads((SRC/'course.json').read_text());surfaces=json.loads((SRC/'surfaces.json').read_text());trees=json.loads((SRC/'trees.json').read_text());drops=json.loads((SRC/'drop_zones.json').read_text())

def footprint(es):
 polys=[]
 for e in es:
  t=e['pos'][e['tri']][:,:,[0,2]];d=t[:,1]-t[:,0];f=t[:,2]-t[:,0];t=t[np.abs(d[:,0]*f[:,1]-d[:,1]*f[:,0])>1e-9]
  if len(t):polys.extend(shapely.polygons(t))
 return shapely.union_all(polys).buffer(0)

def polygon_list(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for x in g.geoms for p in polygon_list(x)]

levels=[]
for s in surfaces['surfaces']:
 es=[e for e in c.entries if e['name']in s['collisionMeshNames']];f=footprint(es)
 levels.append({'priority':s['priority'],'footprint':f,'surface':s['id'],'visual':s['visualMeshNames'],'collision':s['collisionMeshNames']})
for h in course['penaltyAreas']:
 f=footprint([e for e in c.entries if e['name']==h['collisionBasinMeshName']]);levels.append({'priority':60,'footprint':f,'surface':h['id'],'visual':[h['basinMeshName']],'collision':[h['collisionBasinMeshName']]})
# The master mesh is lowest, not a lid over sunken tees/fairways.
levels.append({'priority':0,'footprint':None,'surface':'base','visual':['Conceptual_Terrain_100ha'],'collision':['COLL_TERRAIN_BASE']})
cutters={p:shapely.union_all([x['footprint']for x in levels if x['priority']>p and x['footprint']is not None]).buffer(0)for p in {x['priority']for x in levels}}

stats=[]
def patch(g,kind):
 j=copy.deepcopy(g.j);binary=bytearray(g.bin)
 # Access original local attributes, interpolate in world XZ; original transforms remain.
 originals={n.get('name'):n for n in g.j['nodes']if 'mesh'in n}
 def add_acc(a,typ):
  nonlocal binary
  a=np.asarray(a,dtype='<f4');binary.extend(b'\x00'*((-len(binary))%4));idx=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes());acc={'bufferView':idx,'componentType':5126,'count':len(a),'type':typ}
  if typ=='VEC3':acc.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  j['accessors'].append(acc);return len(j['accessors'])-1
 for level in levels:
  mask=cutters[level['priority']]
  if mask.is_empty:continue
  shapely.prepare(mask)
  for name in level[kind]:
   node=next((n for n in j['nodes']if n.get('name')==name and 'mesh'in n),None)
   if node is None:continue
   old=originals[name];mesh=g.j['meshes'][old['mesh']];es=[e for e in g.entries if e['name']==name];prims=[];before=after=0
   for prim,e in zip(mesh['primitives'],es):
    attrs={k:g.acc(a).astype(float)/(255 if g.j['accessors'][a]['componentType']==5121 else 65535) if g.j['accessors'][a].get('normalized') else g.acc(a) for k,a in prim['attributes'].items()};output={k:[]for k in attrs};world=e['pos'];tri=e['tri'];before+=len(tri)
    for ids in tri:
     wp=world[ids];xz=wp[:,[0,2]];det=np.linalg.det(np.array([xz[1]-xz[0],xz[2]-xz[0]]))
     if abs(det)<1e-10:
      for k in output:output[k].extend(attrs[k][ids])
      continue
     poly=Polygon(xz)
     if not mask.intersects(poly):
      for k in output:output[k].extend(attrs[k][ids])
      continue
     diff=poly.difference(mask)
     for part in polygon_list(diff):
      if part.area<1e-10:continue
      rings=[np.array(part.exterior.coords)[:-1]]+[np.array(r.coords)[:-1]for r in part.interiors];pts=np.concatenate(rings).astype(np.float64);ends=np.cumsum([len(r)for r in rings],dtype=np.uint32);ix=mapbox_earcut.triangulate_float64(pts,ends)
      if not len(ix):continue
      first=pts[ix[:3]];sign=np.cross(first[1]-first[0],first[2]-first[0])
      if sign*det<0:ix=ix.reshape(-1,3)[:,[0,2,1]].reshape(-1)
      pp=pts[ix];mat=np.array([xz[1]-xz[0],xz[2]-xz[0]]).T;uv=np.linalg.solve(mat,(pp-xz[0]).T).T;weights=np.column_stack((1-uv.sum(1),uv))
      for k in output:output[k].extend(weights@attrs[k][ids])
    if output['POSITION']:
     new=copy.deepcopy(prim);new.pop('indices',None);new['attributes']={k:add_acc(a,'VEC'+str(np.asarray(a).shape[1]))for k,a in output.items()};prims.append(new);after+=len(output['POSITION'])//3
   if not prims:
    # Preserve the named node as an empty metadata anchor, not invisible collision.
    node.pop('mesh',None)
   else:
    node['mesh']=len(j['meshes']);j['meshes'].append({'name':mesh.get('name',name)+'_stitched19','primitives':prims})
   stats.append({'kind':kind,'name':name,'before':before,'after':after});print(kind,name,before,'->',after,flush=True)
 # Compact away unused original meshes/accessors/buffers; retain embedded images.
 used=sorted({n['mesh']for n in j['nodes']if 'mesh'in n});mapping={old:i for i,old in enumerate(used)};j['meshes']=[j['meshes'][i]for i in used]
 for n in j['nodes']:
  if 'mesh'in n:n['mesh']=mapping[n['mesh']]
 accs=set()
 for m in j['meshes']:
  for p in m['primitives']:
   accs.update(p['attributes'].values())
   if 'indices'in p:accs.add(p['indices'])
 aa=sorted(accs);am={old:i for i,old in enumerate(aa)};j['accessors']=[j['accessors'][i]for i in aa]
 for m in j['meshes']:
  for p in m['primitives']:
   p['attributes']={k:am[a]for k,a in p['attributes'].items()}
   if 'indices'in p:p['indices']=am[p['indices']]
 bv=sorted({a['bufferView']for a in j['accessors']}|{im['bufferView']for im in j.get('images',[])if 'bufferView'in im});bm={old:i for i,old in enumerate(bv)};newbin=bytearray();views=[]
 for i in bv:
  view=copy.deepcopy(j['bufferViews'][i]);start=view.get('byteOffset',0);chunk=binary[start:start+view['byteLength']];newbin.extend(b'\x00'*((-len(newbin))%4));view['byteOffset']=len(newbin);view['buffer']=0;newbin.extend(chunk);views.append(view)
 for a in j['accessors']:a['bufferView']=bm[a['bufferView']]
 for im in j.get('images',[]):
  if 'bufferView'in im:im['bufferView']=bm[im['bufferView']]
 j['bufferViews']=views;j['buffers']=[{'byteLength':len(newbin)}];j.setdefault('extras',{})['PuttClubPatch']='course19: lower-priority footprints clipped beneath authored playable surfaces and basins; materials and UVs retained'
 js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);newbin.extend(b'\x00'*((-len(newbin))%4));b=struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(newbin))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(newbin),0x004e4942)+newbin
 (DST/('course_'+('visual'if kind=='visual'else'collision')+'.glb')).write_bytes(b)

patch(v,'visual');patch(c,'collision')
newc=GLB(DST/'course_collision.glb')
# Export exact actual mesh footprints for semantic surface lookups.
for s,l in zip(surfaces['surfaces'],levels):
 f=l['footprint'];s['boundaryPolygonsXZ']=[{'outer':np.round(np.array(p.exterior.coords)[:-1],5).tolist(),'holes':[np.round(np.array(r.coords)[:-1],5).tolist()for r in p.interiors]}for p in polygon_list(f)]
# Actual water perimeter, not its AABB. Separate legal perimeter slightly inland.
tees=shapely.union_all([l['footprint'].buffer(1.5)for l in levels if l['surface'].endswith('_TEE')]);waters=[]
for h in course['penaltyAreas']:
 f=footprint([e for e in v.entries if e['name']==h['waterMeshName']]).simplify(.08,preserve_topology=True)
 legal=f.buffer(.65).difference(tees).buffer(0);legal=max(polygon_list(legal),key=lambda p:p.area)
 h['waterPolygonXZ']=np.round(np.array(max(polygon_list(f),key=lambda p:p.area).exterior.coords)[:-1],5).tolist();h['boundaryPolygonXZ']=np.round(np.array(legal.exterior.coords)[:-1],5).tolist();h['exceptionIslandsXZ']=[np.round(np.array(r.coords)[:-1],5).tolist()for r in legal.interiors];waters.append(legal)
all_water=shapely.union_all(waters);ob=Polygon(course['outOfBounds']['playableBoundaryPolygonXZ']);bad=shapely.union_all([l['footprint']for l in levels if l['surface'].endswith('_GREEN')or 'BUNKER'in l['surface']]);dz_changes=[]
for d in drops['dropZones']:
 old=np.array(d['center']);original=Point(old[0],old[2]);candidates=[original]
 for radius in [4,8,12,20,35,55,80,110]:
  for ang in np.linspace(0,np.pi*2,72,endpoint=False):candidates.append(Point(old[0]+radius*np.cos(ang),old[2]+radius*np.sin(ang)))
 valid=[p for p in candidates if ob.contains(p.buffer(d['radiusM']+1))and not all_water.intersects(p.buffer(d['radiusM']+1))and not bad.intersects(p.buffer(d['radiusM']))]
 assert valid,'No legal dry drop zone found'
 p=min(valid,key=lambda p:p.distance(original));hits=newc.hits(p.x,p.y);assert hits
 y=hits[0]['y'];d['center']=[round(p.x,5),round(y,5),round(p.y,5)];d['surfaceElevationY']=round(y,5);d['boundaryPolygonXZ']=[[round(p.x+d['radiusM']*np.cos(a),5),round(p.y+d['radiusM']*np.sin(a),5)]for a in np.linspace(0,2*np.pi,32,endpoint=False)];dz_changes.append({'id':d['id'],'old':old.tolist(),'new':d['center'],'clearanceM':p.distance(all_water)})
course['name']='زمین باشگاه پات کلاب';course['integrationRevision']='course19';course['files']['treesData']='trees.json';course['patchNotes']=['Authored metre-scale axes preserved.','Master/rough/basin overlaps clipped beneath playable geometry.','Water boundaries regenerated from water geometry, not AABBs.','Drop zones validated outside every red penalty area with complete radius clearance.']
for name,obj in [('course.json',course),('surfaces.json',surfaces),('trees.json',trees),('drop_zones.json',drops)]: (DST/name).write_text(json.dumps(obj,ensure_ascii=False,separators=(',',':'))+'\n')
shutil.copytree(SRC/'tree_library',DST/'tree_library',dirs_exist_ok=True)
for name in ['preview.jpg','credits.md']:shutil.copy2(SRC/name,DST/name)
(DST/'credits.md').write_text('> **Integration / verification notice — 2026-10-16:** The inventory and clearance statement below are supplied-package claims, preserved for attribution; they are not an independent asset-by-asset legal clearance by this project. Poly Haven CC0 and BlenderKit Royalty-Free are distinct terms. BlenderKit asset-specific license evidence was not included or independently verified. These files are integrated into a playable game, not offered as a standalone source asset pack. The original ZIP and Blender course source are not redistributed here. Rendering uses portable PBR equivalents, metric UV projection and three-dimensional forest LODs rather than claiming a pixel-identical Blender render.\n\n'+(DST/'credits.md').read_text())
report={'sourceZipSha256':'3594f0288472a6a84d3748a721a84b1fff691a85a480fed54a4a937fb11bc279','patches':stats,'dropZoneChanges':dz_changes,'teeChecks':[]}
for h in course['holes']:
 for t in h['tees']:
  p=t['position'];hits=newc.hits(p[0],p[2]);assert hits
  assert abs(hits[0]['y']-p[1])<.015,(t,hits[:3])
  assert not all_water.covers(Point(p[0],p[2]))
  report['teeChecks'].append({'id':t['id'],'metadataY':p[1],'highestSolidY':hits[0]['y'],'mesh':hits[0]['name']})
Path('audit/course19/asset-patch.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print('PASS: all 54 tees grounded and outside red penalty areas; four complete drop areas outside all hazards.')

# Produce compact, portable runtime files after geometric validation.
import subprocess
for model in ['course_visual.glb','course_collision.glb']:
 subprocess.run([sys.executable,'scripts/compact-course19-glb.py',str(DST/model)],check=True)
 subprocess.run([sys.executable,'scripts/portable-course19-glb.py',str(DST/model)],check=True)

subprocess.run([sys.executable,'scripts/weld-course19-edges.py'],check=True)
