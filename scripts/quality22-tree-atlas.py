"""Multi-view far LODs rendered from the actual source trees, not cones.
Near trees retain original 3D geometry. Four conifers are proven affine copies.
"""
import bpy,json,math,numpy as np,resource
from pathlib import Path
from PIL import Image
from scipy.ndimage import distance_transform_edt
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
root=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve();out=Path('public/courses/puttclub/native')
with bpy.data.libraries.load(str(root/'course.blend'),link=False)as(a,b):b.scenes=list(a.scenes)
original=max(bpy.data.scenes,key=lambda s:len(s.objects));s=bpy.data.scenes.new('Quality22_Source_Impostors');s.world=original.world
s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.cycles.device='CPU';s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
s.view_settings.view_transform=original.view_settings.view_transform;s.view_settings.look=original.view_settings.look;s.view_settings.exposure=original.view_settings.exposure
sun=bpy.data.objects['Sun_Cinema_Key'].copy();s.collection.objects.link(sun)
cd=bpy.data.cameras.new('AtlasCamera');cd.type='ORTHO';cam=bpy.data.objects.new('AtlasCamera',cd);s.collection.objects.link(cam);s.camera=cam;bpy.context.window.scene=s
result=[];temp=Path('.cache/quality22/atlas-tile.png').resolve()
for pi,name in enumerate(['BK_Tree_01_Evergreen_Spruce','BK_Tree_02_Black_Alder']):
 o=bpy.data.objects[name].copy();o.location=(0,0,0);s.collection.objects.link(o);bb=np.array(o.bound_box);center=Vector(bb.mean(0));radius=max((Vector(c)-center).length for c in bb);cd.ortho_scale=radius*2.12
 atlas=Image.new('RGBA',(2048,2048));s.render.filepath=str(temp)
 for pitchi,pitch in enumerate([0,30,60]):
  for yi in range(16):
   yaw=yi*math.tau/16;p=math.radians(pitch);direction=Vector((math.sin(yaw)*math.cos(p),-math.cos(yaw)*math.cos(p),math.sin(p)));cam.location=center+direction*radius*4;cam.rotation_euler=(-direction).to_track_quat('-Z','Y').to_euler()
   bpy.ops.render.render(write_still=True,scene=s.name)
   ar=np.array(Image.open(temp).convert('RGBA'));alpha=ar[:,:,3];mask=alpha>8
   if mask.any():
    dist,inds=distance_transform_edt(~mask,return_indices=True);fill=(~mask)&(dist<=8);ar[fill,:3]=ar[inds[0][fill],inds[1][fill],:3]
   idx=pitchi*16+yi;atlas.paste(Image.fromarray(ar),(idx%8*256,idx//8*256))
  print('ATLAS',pi,'pitch',pitch,'done; MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
 filename=f'tree-atlas-{pi}.png';atlas.save(out/filename,optimize=True);result.append({'prototype':pi,'url':'native/'+filename,'orthoScale':cd.ortho_scale,'center':[center.x,center.z,-center.y],'yawViews':16,'pitchViews':[0,30,60],'tilePixels':256,'grid':8});s.collection.objects.unlink(o)
(out/'tree-atlases.json').write_text(json.dumps({'method':'Original authored tree geometry, shader graphs, world, sun, AgX look/exposure; Cycles CPU8 instead of Eevee. Multi-view distant LOD only; no generic cones.','atlases':result},indent=2));print('COMPLETE',flush=True)
