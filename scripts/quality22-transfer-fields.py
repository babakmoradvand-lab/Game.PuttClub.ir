"""Transfer authored shader fields/UVs onto existing gameplay render topology.
No position, index, normal or collision changes. Compact obsolete texture payloads.
"""
from pathlib import Path
import json,struct,numpy as np,hashlib
from scipy.spatial import cKDTree
ns={};exec(Path('scripts/audit-puttclub-course.py').read_text().split('course=json.loads')[0],ns);GLB=ns['GLB']
source=np.load('.cache/quality22/all-source-fields.npz');index={x['name']:x for x in json.load(open('.cache/quality22/all-source-fields.json'))};spec=json.load(open('public/courses/puttclub/native/source.json'));mats={m['name']:m for m in spec['materials']};report=[]
master=index['Conceptual_Terrain_100ha'];mp=source[master['key']+'_position'];mt=source[master['key']+'_tri'];mxy=mp[mt][:,:,:2];ma=mxy[:,1]-mxy[:,0];mb=mxy[:,2]-mxy[:,0];md=ma[:,0]*mb[:,1]-ma[:,1]*mb[:,0];mv=np.flatnonzero(np.abs(md)>1e-12);mTree=cKDTree(mxy[mv].mean(1));mColor=source[master['fields']['Terrain_Display_Color']['key']][:,:3]
def masterSample(world):
 q=world[:,[0,2]]*np.array([1,-1]);_,ii=mTree.query(q,k=12,workers=1);tt=mv[ii];d=q[:,None,:]-mxy[tt,0];a=ma[tt];b=mb[tt];det=md[tt];u=(d[:,:,0]*b[:,:,1]-d[:,:,1]*b[:,:,0])/det;v=(a[:,:,0]*d[:,:,1]-a[:,:,1]*d[:,:,0])/det;w=np.stack([1-u-v,u,v],-1);c=np.argmin(np.maximum(-w,0).sum(-1),axis=1);rows=np.arange(len(q));ids=mt[tt[rows,c]];weights=np.clip(w[rows,c],0,1);weights/=weights.sum(1)[:,None];return np.einsum('ni,nij->nj',weights,mColor[ids])
root=Path('public/courses/puttclub')
for file in [root/'course_visual.glb',*sorted((root/'tree_library').glob('*.glb'))]:
 g=GLB(file);j=g.j;binary=bytearray(g.bin);protected=[];entryMap={}
 for e in g.entries:entryMap.setdefault(e['name'],[]).append(e)
 def add(a,t):
  a=np.asarray(a,dtype='<f4');binary.extend(b'\0'*(-len(binary)%4));vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes());d={'bufferView':vi,'componentType':5126,'count':len(a),'type':t}
  if t=='VEC3':d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
  j['accessors'].append(d);return len(j['accessors'])-1
 for node in j['nodes']:
  if 'mesh'not in node:continue
  name=node.get('name','');rec=index.get(name)if file.name=='course_visual.glb'else None;mapping=None
  if rec:
   base=source[rec['key']+'_position'][:,[0,2,1]]*np.array([1,1,-1]);tris=source[rec['key']+'_tri'];xp=base[tris][:,:,[0,2]];d1=xp[:,1]-xp[:,0];d2=xp[:,2]-xp[:,0];det=d1[:,0]*d2[:,1]-d1[:,1]*d2[:,0];valid=np.abs(det)>1e-12;triids=np.flatnonzero(valid);tree=cKDTree(xp[valid].mean(1));vTree=cKDTree(base[:,[0,2]])
   def mapping(pos):
    _,candidates=tree.query(pos[:,[0,2]],k=min(12,len(triids)),workers=1)
    if candidates.ndim==1:candidates=candidates[:,None]
    tids=triids[candidates];pp=xp[tids];q=pos[:,None,[0,2]]-pp[:,:,0];aa=d1[tids];bb=d2[tids];de=det[tids];u=(q[:,:,0]*bb[:,:,1]-q[:,:,1]*bb[:,:,0])/de;v=(aa[:,:,0]*q[:,:,1]-aa[:,:,1]*q[:,:,0])/de;w=np.stack([1-u-v,u,v],-1);bad=np.maximum(-w,0).sum(-1);choice=np.argmin(bad,axis=1);row=np.arange(len(pos));tt=tids[row,choice];ww=w[row,choice];fail=bad[row,choice]>.001
    if fail.any():
     _,nearest=vTree.query(pos[fail][:,[0,2]]);tt=tt.copy();ww=ww.copy();# outside source is not extrapolated
     ids=tris[tt];ids[fail]=nearest[:,None];ww[fail]=[1,0,0]
    else:ids=tris[tt]
    return ids,ww,int(fail.sum())
  for pi,prim in enumerate(j['meshes'][node['mesh']]['primitives']):
   a=prim['attributes'];pos=g.acc(a['POSITION']);protected.append(hashlib.sha256(np.asarray(pos).tobytes()).hexdigest());count=len(pos);color=np.ones((count,3));mask=np.zeros((count,4));uv=None;fail=0
   if rec and mapping:
    ids,w,fail=mapping(pos)
    def field(n):
     f=rec['fields'].get(n)
     if not f or f['domain']!='POINT':return None
     ar=source[f['key']];return np.einsum('ni,nij->nj',w,ar[ids])
    mat=mats.get(j['materials'][prim.get('material',0)].get('name'),{});requested=[]
    for n in mat.get('nodes',[]):
     if n['type']=='ShaderNodeVertexColor':requested.append(n.get('layer_name')or rec['activeColor'])
     if n['type']=='ShaderNodeAttribute'and n.get('attribute_name')=='Terrain_Display_Color':requested.append('Terrain_Display_Color')
    colorName='GrassColor'if'GrassColor'in requested else'Terrain_Display_Color'
    ar=field(colorName)
    if ar is not None:color=ar[:,:3]
    elif'GrassColor'in requested:
     bs=next((n for n in mat.get('nodes',[])if n['type']=='ShaderNodeBsdfPrincipled'),None)
     if bs:color[:]=next(i['value']for i in bs['inputs']if i['name']=='Base Color')[:3]
    for ci,fieldname in enumerate(['lake_depth','turf_mask','RakeWeight','cup_mask']):
     ar=field(fieldname)
     if ar is None and fieldname=='lake_depth':ar=field('water_depth')
     if ar is not None:mask[:,ci]=ar[:,0]
    if rec['key']+'_uv'in source:
     u=source[rec['key']+'_uv'];ls=source[rec['key']+'_loops'];perV=np.zeros((len(base),2));hits=np.zeros(len(base));np.add.at(perV,ls,u);np.add.at(hits,ls,1);perV/=np.maximum(hits[:,None],1);uv=np.einsum('ni,nij->nj',w,perV[ids])
   baseColor=masterSample(entryMap[name][pi]['pos'])if file.name=='course_visual.glb'else np.ones((count,3))
   a['_PC_BASE_COLOR']=add(baseColor,'VEC3');a['COLOR_0']=add(np.clip(color,0,1),'VEC3');a['_PC_MASK']=add(mask,'VEC4')
   if uv is not None:a['TEXCOORD_0']=add(uv,'VEC2')
   elif'TEXCOORD_0'not in a:a['TEXCOORD_0']=add(pos[:,[0,2]],'VEC2')
   a.pop('COLOR_1',None)
   report.append({'file':file.name,'object':name,'vertices':count,'hasSource':bool(rec),'outsideSourceFallbackVertices':fail,'colorMean':np.mean(color,axis=0).tolist(),'lakeDepthRange':[float(mask[:,0].min()),float(mask[:,0].max())]})
 # Source-native shader replaces invalid fallback material graphs. Keep names, not obsolete image blobs.
 for mat in j.get('materials',[]):
  name=mat.get('name');mat.clear();mat.update({'name':name,'doubleSided':True,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.9}})
 for k in ['textures','images','samplers','extensionsRequired','extensionsUsed']:j.pop(k,None)
 used=set()
 for m in j['meshes']:
  for p in m['primitives']:
   used.update(p['attributes'].values())
   if'indices'in p:used.add(p['indices'])
 al=sorted(used);am={old:i for i,old in enumerate(al)};j['accessors']=[j['accessors'][i]for i in al]
 for m in j['meshes']:
  for p in m['primitives']:
   p['attributes']={k:am[x]for k,x in p['attributes'].items()}
   if'indices'in p:p['indices']=am[p['indices']]
 vl=sorted({a['bufferView']for a in j['accessors']});vm={x:i for i,x in enumerate(vl)};new=bytearray();views=[]
 for vi in vl:
  v=dict(j['bufferViews'][vi]);start=v.get('byteOffset',0);chunk=binary[start:start+v['byteLength']];new.extend(b'\0'*(-len(new)%4));v['byteOffset']=len(new);v['buffer']=0;new.extend(chunk);views.append(v)
 for a in j['accessors']:a['bufferView']=vm[a['bufferView']]
 j['bufferViews']=views;j['buffers']=[{'byteLength':len(new)}];j.setdefault('extras',{})['PuttClubSourceFields']='quality22: original named shader fields and original UVs transferred; gameplay geometry unchanged'
 js=json.dumps(j,separators=(',',':')).encode();js+=b' '*(-len(js)%4);new.extend(b'\0'*(-len(new)%4));file.write_bytes(struct.pack('<4sII',b'glTF',2,28+len(js)+len(new))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(new),0x004e4942)+new)
 check=GLB(file);after=[hashlib.sha256(check.acc(p['attributes']['POSITION']).tobytes()).hexdigest()for n in check.j['nodes']if'mesh'in n for p in check.j['meshes'][n['mesh']]['primitives']];assert after==protected,'Position changed!';print(file,'bytes',file.stat().st_size,flush=True)
Path('audit/quality22/field-transfer.json').write_text(json.dumps(report,indent=2))
