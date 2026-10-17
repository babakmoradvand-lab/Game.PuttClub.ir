"""Source-derived runtime inputs, WITHOUT full-scene geometry-node evaluation.
Exports images/named fields/nature prototypes and the exact source display transform.
"""
import bpy,json,numpy as np,hashlib,struct,io,math,PyOpenColorIO as OCIO
from pathlib import Path
from PIL import Image
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
src=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve();out=Path('public/courses/puttclub/native');out.mkdir(parents=True,exist_ok=True)
with bpy.data.libraries.load(str(src/'course.blend'),link=False)as(a,b):b.scenes=list(a.scenes)
original=max(bpy.data.scenes,key=lambda s:len(s.objects));recovery=Path('.cache/quality22/recovered-textures').resolve()
meta=json.load(open('audit/quality22/source-details.json'));meta['images']={};meta['objects']={};meta['scatter']=[]
# Export exact original encoded images or the approved same-asset official recovery.
for im in bpy.data.images:
 if im.packed_file:encoded=bytes(im.packed_file.data)
 elif(recovery/im.name).exists():encoded=(recovery/im.name).read_bytes();im.filepath=str(recovery/im.name)
 else:continue
 ext='png'if encoded[:8]==b'\x89PNG\r\n\x1a\n'else'webp'if encoded[:4]==b'RIFF'and encoded[8:12]==b'WEBP'else'jpg';name=hashlib.sha256(encoded).hexdigest()[:20]+'.'+ext;(out/name).write_bytes(encoded)
 meta['images'][im.name]={'url':'native/'+name,'colorSpace':im.colorspace_settings.name,'sha256':hashlib.sha256(encoded).hexdigest()}
# Extra shader properties absent from the first inspection.
for mat in meta['materials']:
 orig=bpy.data.materials[mat['name']]
 mat['surfaceRenderMethod']=orig.surface_render_method
 mat['links']=[{'from':[l.from_node.name,l.from_socket.name],'to':[l.to_node.name,l.to_socket.name],'toIndex':list(l.to_node.inputs).index(l.to_socket)}for l in orig.node_tree.links]
 for node in mat['nodes']:
  n=orig.node_tree.nodes.get(node['name'])
  for prop in ['bands_direction','wave_type','wave_profile','normalize','noise_dimensions','noise_type','use_clamp','invert','space','attribute_type']:
   if hasattr(n,prop):node[prop]=getattr(n,prop)
  if n.type=='VALTORGB':node['rampInterpolation']=n.color_ramp.interpolation
  if n.type=='VALUE':node['value']=n.outputs[0].default_value
# Keep all source fields required by material graphs; encode source base geometry privately for transfer.
arrays={};index=[]
for o in bpy.data.objects:
 if o.type!='MESH':continue
 m=o.data;k='m'+str(len(index));v=np.empty(len(m.vertices)*3,'f4');m.vertices.foreach_get('co',v);v=v.reshape(-1,3);arrays[k+'_position']=v
 m.calc_loop_triangles();tri=np.empty(len(m.loop_triangles)*3,'i4');m.loop_triangles.foreach_get('vertices',tri);arrays[k+'_tri']=tri.reshape(-1,3)
 rec={'name':o.name,'key':k,'fields':{},'activeColor':m.color_attributes.active_color_name}
 bb=np.array(o.bound_box);meta['objects'][o.name]={'min':bb.min(0).tolist(),'max':bb.max(0).tolist()}
 for attr in m.attributes:
  if attr.name.startswith('.')or attr.name in ['position','material_index']:continue
  if attr.data_type in ['FLOAT_COLOR','BYTE_COLOR']:count=4;prop='color'
  elif attr.data_type=='FLOAT':count=1;prop='value'
  else:continue
  ar=np.empty(len(attr.data)*count,'f4');attr.data.foreach_get(prop,ar);ar=ar.reshape(-1,count);ak=k+'_a'+str(len(rec['fields']));arrays[ak]=ar;rec['fields'][attr.name]={'key':ak,'domain':attr.domain}
 if len(m.uv_layers):
  uv=np.empty(len(m.uv_layers[0].data)*2,'f4');m.uv_layers[0].data.foreach_get('uv',uv);arrays[k+'_uv']=uv.reshape(-1,2);loops=np.empty(len(m.loops),'i4');m.loops.foreach_get('vertex_index',loops);arrays[k+'_loops']=loops
 index.append(rec)
np.savez_compressed('.cache/quality22/all-source-fields.npz',**arrays);Path('.cache/quality22/all-source-fields.json').write_text(json.dumps(index))
# Exact original OCIO AgX look/exposure as a log-shaped 32³ LUT, not an ACES approximation.
config=OCIO.Config.CreateFromFile(str(Path(bpy.utils.resource_path('LOCAL'))/'datafiles/colormanagement/config.ocio'))
vp=OCIO.LegacyViewingPipeline();vp.setDisplayViewTransform(OCIO.DisplayViewTransform(src='scene_linear',display='sRGB',view=original.view_settings.view_transform));vp.setLooksOverrideEnabled(True);vp.setLooksOverride(original.view_settings.look)
mat=OCIO.MatrixTransform();e=2**original.view_settings.exposure;mat.setMatrix([e,0,0,0,0,e,0,0,0,0,e,0,0,0,0,1]);vp.setLinearCC(mat);proc=vp.getProcessor(config,config.getCurrentContext()).getDefaultCPUProcessor()
N=32;g,b,r=np.mgrid[0:N,0:N,0:N];linear=2**(np.stack([r,g,b],-1).astype('f4')/(N-1)*24-10);flat=linear.reshape(-1,3).copy();proc.applyRGB(flat);lut=np.clip(flat.reshape(N,N,N,3),0,1).reshape(N,N*N,3);Image.fromarray(np.round(lut*255).astype('uint8')).save(out/'source-agx.png')
meta['grading']={'url':'native/source-agx.png','size':N,'logMin':-10,'logMax':14,'view':original.view_settings.view_transform,'look':original.view_settings.look,'exposure':original.view_settings.exposure,'method':'Original Blender OCIO LegacyViewingPipeline with original exposure and look override'}
# Original sun orientation, not a guessed direction based on its location.
sun=bpy.data.objects['Sun_Cinema_Key'];toward=-(sun.rotation_euler.to_quaternion()@Vector((0,0,-1)));meta['sun']={'direction':[toward.x,toward.z,-toward.y],'energy':sun.data.energy,'color':list(sun.data.color)}
# Nature scatter sources retain original point positions, rotations, scales and collection child order.
collections=set()
for o in bpy.data.objects:
 mods=[m for m in o.modifiers if m.type=='NODES'and m.node_group.name.startswith('GN_')and 'Forest_Scatter_01'not in m.node_group.name]
 if not mods or 'inst_idx'not in o.data.attributes:continue
 group=mods[0].node_group;ci=next(n for n in group.nodes if n.type=='COLLECTION_INFO');coll=ci.inputs['Collection'].default_value;collections.add(coll.name);children=sorted(x.name for x in coll.objects)
 def vals(name,prop,width,dtype):
  a=o.data.attributes[name];v=np.empty(len(a.data)*width,dtype);a.data.foreach_get(prop,v);return v.reshape(-1,width)
 pos=np.array([v.co[:]for v in o.data.vertices]);rot=vals('inst_rot','vector',3,'f4');scale=vals('inst_scl','vector',3,'f4');ids=vals('inst_idx','value',1,'i4').reshape(-1)
 points=[]
 for p,r0,s0,idx in zip(pos,rot,scale,ids):
  points.append({'p':[float(p[0]),float(p[2]),float(-p[1])],'r':r0.tolist(),'s':s0.tolist(),'i':int(idx)})
 meta['scatter'].append({'name':o.name,'collection':coll.name,'children':children,'points':points})
# Compact GLB of original nature prototypes, with original UVs/material names; no generic replacement shapes.
protos=sorted({o.name for c in collections for o in bpy.data.collections[c].objects if o.type=='MESH'}|{'H01_Hero_Corridor_Rough_GG04','H01_Hero_Fairway_Approach'})
binary=bytearray();j={'asset':{'version':'2.0','generator':'PuttClub source-preserving nature extraction'},'scene':0,'scenes':[{'nodes':[]}],'nodes':[],'meshes':[],'materials':[],'accessors':[],'bufferViews':[],'buffers':[{}]};mats={}
def acc(a,t):
 a=np.asarray(a,dtype='<f4');binary.extend(b'\0'*(-len(binary)%4));vi=len(j['bufferViews']);j['bufferViews'].append({'buffer':0,'byteOffset':len(binary),'byteLength':a.nbytes});binary.extend(a.tobytes());d={'bufferView':vi,'componentType':5126,'count':len(a),'type':t}
 if t=='VEC3':d.update(min=a.min(0).tolist(),max=a.max(0).tolist())
 j['accessors'].append(d);return len(j['accessors'])-1
for name in protos:
 o=bpy.data.objects[name];m=o.data;m.calc_loop_triangles();v=np.array([v.co[:]for v in m.vertices]);ns=np.array([n.vector[:]for n in m.corner_normals]);uv=np.array([v.uv[:]for v in m.uv_layers[0].data])if m.uv_layers else None;prims=[]
 for mi,mat in enumerate(m.materials):
  ts=[t for t in m.loop_triangles if t.material_index==mi]
  if not ts or not mat:continue
  if mat.name not in mats:mats[mat.name]=len(j['materials']);j['materials'].append({'name':mat.name,'doubleSided':True,'pbrMetallicRoughness':{'metallicFactor':0,'roughnessFactor':.9}})
  ids=np.array([i for t in ts for i in t.vertices]);ls=np.array([i for t in ts for i in t.loops]);p=v[ids][:,[0,2,1]]*np.array([1,1,-1]);n=ns[ls][:,[0,2,1]]*np.array([1,1,-1]);attrs={'POSITION':acc(p,'VEC3'),'NORMAL':acc(n,'VEC3')}
  if uv is not None:attrs['TEXCOORD_0']=acc(uv[ls],'VEC2')
  col=m.color_attributes.get('GrassColor')or m.color_attributes.get('Terrain_Display_Color');colors=np.ones((len(p),3))
  if col:
   ca=np.array([x.color[:]for x in col.data]);colors=ca[ids if col.domain=='POINT'else ls,:3]
  attrs['COLOR_0']=acc(colors,'VEC3');attrs['_PC_MASK']=acc(np.zeros((len(p),4)),'VEC4');prims.append({'attributes':attrs,'material':mats[mat.name]})
 j['scenes'][0]['nodes'].append(len(j['nodes']));j['nodes'].append({'name':name,'mesh':len(j['meshes'])});j['meshes'].append({'name':name,'primitives':prims})
j['buffers'][0]['byteLength']=len(binary);js=json.dumps(j,separators=(',',':')).encode();js+=b' '*(-len(js)%4);binary.extend(b'\0'*(-len(binary)%4));(out/'nature.glb').write_bytes(struct.pack('<4sII',b'glTF',2,28+len(js)+len(binary))+struct.pack('<II',len(js),0x4e4f534a)+js+struct.pack('<II',len(binary),0x004e4942)+binary)
# Prove which conifer prototypes are affine scalings of the exact first source mesh.
base=bpy.data.objects['BK_Tree_01_Evergreen_Spruce'];basev=np.array([v.co[:]for v in base.data.vertices]);treeinfo=[]
for o in sorted([o for o in bpy.data.objects if o.name.startswith('BK_Tree_')],key=lambda o:o.name):
 v=np.array([v.co[:]for v in o.data.vertices]);fit=np.sum(basev*v,0)/np.sum(basev*basev,0)if len(v)==len(basev)else np.ones(3);err=float(np.max(np.abs(basev*fit-v)))if len(v)==len(basev)else 999
 treeinfo.append({'name':o.name,'prototype':0 if err<.0001 else 1,'fit':fit.tolist()if err<.0001 else[1,1,1],'maxAffineErrorM':err,'center':(np.array(o.bound_box).mean(0)[[0,2,1]]*np.array([1,1,-1])).tolist(),'dimensions':list(o.dimensions)})
meta['treeInfo']=treeinfo
(out/'source.json').write_text(json.dumps(meta,separators=(',',':'),default=str));print('Prepared',len(meta['images']),'images;',len(meta['scatter']),'scatter sets;',len(protos),'prototypes; LUT and exact source fields',flush=True)
print('Tree fits',treeinfo,flush=True)
# Small original-sky environment, physically scene-linear Radiance HDR.
s=bpy.data.scenes.new('Quality22_Original_Sky');s.world=original.world;s.render.engine='CYCLES';s.cycles.samples=8;s.render.threads_mode='FIXED';s.render.threads=2;s.cycles.use_denoising=False
camdata=bpy.data.cameras.new('NativeSkyCamera');camdata.type='PANO';camdata.panorama_type='EQUIRECTANGULAR';cam=bpy.data.objects.new('NativeSkyCamera',camdata);s.collection.objects.link(cam);cam.rotation_euler=(math.pi/2,0,0);s.camera=cam;s.render.resolution_x=512;s.render.resolution_y=256;s.render.resolution_percentage=100;s.render.image_settings.file_format='HDR';s.render.filepath=str((out/'source-sky.hdr').resolve());s.view_settings.view_transform='Raw';bpy.context.window.scene=s;bpy.ops.render.render(write_still=True,scene=s.name)
print('SKY DONE',flush=True)
