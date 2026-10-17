"""Bake original grass prototype geometry/materials at authored GN density on 1m²
flat patches, preserving each grass family's blade shapes and colors. Mobile LOD
uses these albedo/normal/AO tiles instead of evaluating millions of blades.
"""
import bpy,json,numpy as np,OpenEXR,math,resource
from pathlib import Path
from PIL import Image
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
root=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve();out=Path('public/courses/puttclub/native');ref=Path('audit/quality22/reference');ref.mkdir(parents=True,exist_ok=True)
with bpy.data.libraries.load(str(root/'course.blend'),link=False)as(a,b):b.scenes=list(a.scenes)
original=max(bpy.data.scenes,key=lambda s:len(s.objects));s=bpy.data.scenes.new('Source_Grass_Families');s.world=original.world
s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100;s.render.image_settings.media_type='MULTI_LAYER_IMAGE';s.render.image_settings.file_format='OPEN_EXR_MULTILAYER';s.render.image_settings.color_depth='32'
s.view_settings.view_transform=original.view_settings.view_transform;s.view_settings.look=original.view_settings.look;s.view_settings.exposure=original.view_settings.exposure
s.view_layers[0].use_pass_normal=True;s.view_layers[0].use_pass_diffuse_color=True;s.view_layers[0].use_pass_ambient_occlusion=True
sun=bpy.data.objects['Sun_Cinema_Key'].copy();s.collection.objects.link(sun);cd=bpy.data.cameras.new('GrassTileCamera');cd.type='ORTHO';cd.ortho_scale=1.;cam=bpy.data.objects.new('GrassTileCamera',cd);s.collection.objects.link(cam);s.camera=cam;bpy.context.window.scene=s
items=[('Fairway_01_Turf_GG02','fairway'),('FirstCut_01_Turf_GG03','firstcut'),('Rough_Tier2_Primary_GG04','rough'),('Rough_Tier3_Heavy_GG05','heavy'),('Rough_Tier4_Native_GG06','native')]
def periodic(a,normal=False):
 h,w=a.shape[:2];y,x=np.mgrid[0:h,0:w];d=np.minimum.reduce([x,w-1-x,y,h-1-y]);f=np.clip(d/24,0,1);f=f*f*(3-2*f);a=a*f[:,:,None]+np.roll(a,(h//2,w//2),(0,1))*(1-f[:,:,None])
 if normal:a/=np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-8)
 return a
records={}
for name,key in items:
 originalObject=bpy.data.objects[name];o=originalObject.copy();m=bpy.data.meshes.new('SourceTile_'+key);vs=np.array([v.co[:]for v in originalObject.data.vertices]);cx,cy,cz=vs.mean(0);m.from_pydata([(cx-.5,cy-.5,cz),(cx+.5,cy-.5,cz),(cx+.5,cy+.5,cz),(cx-.5,cy+.5,cz)],[],[(0,1,2,3)]);m.update();o.data=m
 for material in originalObject.data.materials:m.materials.append(material)
 for a in originalObject.data.color_attributes:
  ar=np.array([x.color[:]for x in a.data]);c=ar.mean(0);new=m.color_attributes.new(a.name,'FLOAT_COLOR','POINT')
  for d in new.data:d.color=c
 base=np.array([d.color[:3]for d in m.color_attributes['GrassColor'].data]).mean(0)
 s.collection.objects.link(o);cam.location=(cx,cy,cz+3);cam.rotation_euler=(0,0,0);path=Path('.cache/quality22/grass-'+key+'.exr').resolve();s.render.filepath=str(path)
 s.render.image_settings.media_type='MULTI_LAYER_IMAGE';s.render.image_settings.file_format='OPEN_EXR_MULTILAYER';bpy.ops.render.render(write_still=True,scene=s.name)
 s.render.image_settings.media_type='IMAGE';s.render.image_settings.file_format='PNG';bpy.data.images['Render Result'].save_render(str((ref/('source-'+key+'-one-metre.png')).resolve()),scene=s)
 f=OpenEXR.File(str(path));data={}
 for part in f.parts:
  pname=part.header.get('name','')
  if'Normal'in pname:data['normal']=np.stack([next(c.pixels for k,c in part.channels.items()if k.endswith('.'+axis))for axis in'XYZ'],-1)
  elif'Diffuse Color'in pname:data['color']=next(iter(part.channels.values())).pixels[:,:,:3]
  elif'Ambient Occlusion'in pname:data['ao']=next(iter(part.channels.values())).pixels[:,:,:3]
 ratio=periodic(data['color'])/np.maximum(base,1e-5);gain=max(1.,float(np.ceil(np.percentile(ratio,99.99))))
 for channel,a in [('normal',periodic(data['normal'],True)*.5+.5),('color',ratio/gain),('ao',periodic(data['ao']))]:
  Image.fromarray(np.round(np.clip(a,0,1)*255).astype('uint8')).save(out/(key+'-micro-'+channel+'.png'))
 mat=originalObject.data.materials[0].name;records[mat]={'key':key,'gain':gain,'baseColor':base.tolist(),'sourceObject':name,'method':'Original grass family and GN settings on a 1 m² flat patch; Cycles24; periodic 24 px border blend; normals normalized','meanAlbedo':data['color'].mean((0,1)).tolist()};s.collection.objects.unlink(o);print('BAKED',name,'gain',gain,'peakMB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
# Green: preserve the actual source crop rather than recreating its cup mask.
f=OpenEXR.File('.cache/quality22/green-original-multilayer.exr');color=next(next(iter(p.channels.values())).pixels[:,:,:3]for p in f.parts if'Diffuse Color'in p.header.get('name',''))
# Actual Ground GrassColor at crop centre, using the containing authored triangle.
g=bpy.data.objects['Green_01_Turf_GG01'];g.data.calc_loop_triangles();r=json.load(open(ref/'green-bake-report.json'));q=np.array(r['cropCenterXY']);v=np.array([v.co[:]for v in g.data.vertices]);cs=np.array([c.color[:3]for c in g.data.color_attributes['GrassColor'].data]);base=None
for t in g.data.loop_triangles:
 ids=np.array(t.vertices);pp=v[ids,:2];aa=np.column_stack([pp[1]-pp[0],pp[2]-pp[0]])
 if abs(np.linalg.det(aa))<1e-10:continue
 uv=np.linalg.solve(aa,q-pp[0]);w=np.array([1-uv.sum(),*uv])
 if w.min()>=-.00001:base=w@cs[ids];break
assert base is not None
ratio=periodic(color)/np.maximum(base,1e-5);gain=max(1.,float(np.ceil(np.percentile(ratio,99.99))));Image.fromarray(np.round(np.clip(ratio/gain,0,1)*255).astype('uint8')).save(out/'green-micro-color.png')
records['GG_GREEN_Living']={'key':'green','gain':gain,'baseColor':base.tolist(),'sourceObject':g.name,'method':'Actual original 1 m² crop at 12000 instances/m²; Cycles32; corrected tangent normals; periodic borders'}
specPath=out/'source.json';spec=json.loads(specPath.read_text());spec['grassMicro']=records;specPath.write_text(json.dumps(spec,separators=(',',':')));(out/'grass-micro.json').write_text(json.dumps(records,indent=2));print('GRASS FAMILIES COMPLETE',flush=True)
