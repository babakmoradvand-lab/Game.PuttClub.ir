"""Repair clipped-face winding and export portable PBR equivalents for Blender-only grass/water nodes."""
from pathlib import Path
import sys,json,struct,numpy as np
p=Path(sys.argv[1]);ns={};exec(Path('scripts/audit-puttclub-course.py').read_text().split('course=json.loads')[0],ns);g=ns['GLB'](p);j=g.j;binary=bytearray(g.bin);flips=0
for m in j['meshes']:
 if '_stitched19'not in m.get('name',''):continue
 for pr in m['primitives']:
  attrs=pr['attributes']
  if 'NORMAL'not in attrs:continue
  pos=g.acc(attrs['POSITION']);nor=g.acc(attrs['NORMAL']);ix=g.acc(pr['indices']).reshape(-1)if'indices'in pr else np.arange(len(pos));tri=ix.reshape(-1,3);pp=pos[tri];nn=nor[tri].mean(1);bad=np.einsum('ij,ij->i',np.cross(pp[:,1]-pp[:,0],pp[:,2]-pp[:,0]),nn)<-1e-10
  if not np.any(bad):continue
  flips+=int(bad.sum());tri[bad]=tri[bad][:,[0,2,1]]
  keys=['indices']if'indices'in pr else list(attrs)
  for k in keys:
   aid=pr['indices']if k=='indices'else attrs[k];a=j['accessors'][aid];view=j['bufferViews'][a['bufferView']];start=view.get('byteOffset',0)+a.get('byteOffset',0)
   arr=ix if k=='indices'else g.acc(aid)[ix]
   typ=ns['DT'][a['componentType']];raw=np.asarray(arr,dtype=typ).tobytes();binary[start:start+len(raw)]=raw
if 'visual'in p.name:
 grass=j['materials'][2]['pbrMetallicRoughness']['baseColorTexture']['index'];normal=j['materials'][2].get('normalTexture',{}).get('index')
 colors={'GG_FAIRWAY_Living':[.72,.85,.66,1],'GG_FIRST_CUT_Living':[.60,.74,.52,1],'GG_GREEN_Living':[.68,.90,.69,1],'GG_PRIMARY_ROUGH_Living':[.54,.67,.43,1],'GG_HEAVY_ROUGH_Living':[.37,.50,.28,1],'GG_NATIVE_Living':[.47,.57,.32,1]}
 gg={i for i,m in enumerate(j['materials'])if m.get('name')in colors}
 for i,m in enumerate(j['materials']):
  if i in gg:
   m['pbrMetallicRoughness']={'baseColorTexture':{'index':grass},'baseColorFactor':colors[m['name']],'metallicFactor':0,'roughnessFactor':.92}
   if normal is not None:m['normalTexture']={'index':normal,'scale':.12}
  if m.get('name')in ['Mat_Luxury_Lake_Water_Optical','Mat_River_Water_Optical']:m['pbrMetallicRoughness']={'baseColorFactor':[.014,.115,.17,.90],'metallicFactor':.04,'roughnessFactor':.18};m['alphaMode']='BLEND'
 for m in j['meshes']:
  for pr in m['primitives']:
   mat=j['materials'][pr.get('material',0)]
   if not any(k.endswith('Texture')for k in mat.get('pbrMetallicRoughness',{}))and 'normalTexture'not in mat:continue
   pos=g.acc(pr['attributes']['POSITION']);uv=pos[:,[0,2]]*.35;uv=uv.astype('<f4');binary.extend(b'\0'*((-len(binary))%4));idx=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':uv.nbytes});binary.extend(uv.tobytes());j['accessors'].append({'bufferView':idx,'componentType':5126,'count':len(uv),'type':'VEC2'});pr['attributes']['TEXCOORD_0']=len(j['accessors'])-1
 # Generated-coordinate Blender nodes did not export UVs. Use metric planar UVs,
 # not a missing texCoord=-1 / white default material in WebGL.
 for mat in j['materials']:
  for data in [mat,mat.get('pbrMetallicRoughness',{})]:
   for k,v in data.items():
    if k.endswith('Texture')and isinstance(v,dict):v.pop('extensions',None);v['texCoord']=0
  if mat.get('name')=='Mat_Master_Terrain_100ha':mat['pbrMetallicRoughness']['baseColorFactor']=[.72,.82,.63,1]
  if mat.get('name')=='Mat_PH_Lake_Beach_And_Bed':mat['pbrMetallicRoughness']['baseColorFactor']=[.60,.48,.32,1]
 # Fix Blender-exported invalid negative texCoord values, retaining UV transforms.
 def fix(x):
  if isinstance(x,dict):
   if x.get('texCoord',0)<0:x.pop('texCoord')
   for v in x.values():fix(v)
  elif isinstance(x,list):
   for v in x:fix(v)
 fix(j)
# Clipping converted normalized byte/short vertex colors to float accessors.
# Restore normalized values instead of feeding 255/65535 into linear shading.
for mesh in j['meshes']:
 for pr in mesh['primitives']:
  for key,aid in pr['attributes'].items():
   if not key.startswith('COLOR_'):continue
   a=j['accessors'][aid]
   if a['componentType']!=5126:continue
   arr=g.acc(aid)
   if float(arr.max())<=1.001:continue
   divisor=255 if float(arr.max())<=255.001 else 65535
   arr=np.clip(arr/divisor,0,1).astype('<f4');view=j['bufferViews'][a['bufferView']];start=view.get('byteOffset',0)+a.get('byteOffset',0);binary[start:start+arr.nbytes]=arr.tobytes()
j['buffers'][0]['byteLength']=len(binary);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);binary.extend(b'\0'*((-len(binary))%4));p.write_bytes(struct.pack('<4sII',b'glTF',2,12+8+len(js)+8+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
print(p,'corrected triangle windings:',flips,'bytes',p.stat().st_size)
