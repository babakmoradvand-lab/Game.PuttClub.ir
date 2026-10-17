"""Small material-reference render from the authored Blender tree, not a full course render.
Uses the original shader graph, packed textures, world, sun and AgX/exposure.
Cycles CPU replaces the source's Eevee renderer for this isolated shader inspection.
"""
import bpy,json,math,sys,resource
from pathlib import Path
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
root=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve()
with bpy.data.libraries.load(str(root/'course.blend'),link=False)as(src,dst):dst.scenes=list(src.scenes)
original=max(bpy.data.scenes,key=lambda s:len(s.objects));s=bpy.data.scenes.new('Quality22_Isolated_Source_Material_Reference');s.world=original.world
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=True
s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100
s.render.film_transparent=True;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA'
s.view_settings.view_transform=original.view_settings.view_transform;s.view_settings.look=original.view_settings.look;s.view_settings.exposure=original.view_settings.exposure;s.view_settings.gamma=original.view_settings.gamma
sun=bpy.data.objects['Sun_Cinema_Key'].copy();s.collection.objects.link(sun)
camera_data=bpy.data.cameras.new('Source_Material_Reference_Camera');camera=bpy.data.objects.new('Source_Material_Reference_Camera',camera_data);s.collection.objects.link(camera);s.camera=camera;camera_data.type='ORTHO'
# Resolve identified missing images, but do not replace any packed image.
recovery=Path('.cache/quality22/recovered-textures').resolve();resolved=[]
for im in bpy.data.images:
 if not im.packed_file and(recovery/im.name).exists():im.filepath=str(recovery/im.name);resolved.append(im.name)
bpy.context.window.scene=s
out=Path('audit/quality22/reference');out.mkdir(parents=True,exist_ok=True)
report={'scope':'Isolated authored-tree shader references, NOT complete original course renders or gameplay screenshots','sourceRenderer':original.render.engine,'referenceRenderer':'CYCLES CPU 32 samples','viewTransform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure,'packedOriginalTreeImages':True,'resolvedOtherImagePaths':len(resolved),'renders':[]}
for name,filename in [('BK_Tree_01_Evergreen_Spruce','source-pine.png'),('BK_Tree_02_Black_Alder','source-alder.png')]:
 o=bpy.data.objects[name].copy();o.location=(0,0,0);s.collection.objects.link(o)
 coords=[Vector(c)for c in o.bound_box];center=sum(coords,Vector())/8;radius=max((v-center).length for v in coords);size=max(o.dimensions.x,o.dimensions.y,o.dimensions.z)*1.15;camera_data.ortho_scale=size
 camera.location=center+Vector((-.35,-1,.12)).normalized()*radius*4;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
 s.render.filepath=str((out/filename).resolve());bpy.ops.render.render(write_still=True,scene=s.name)
 report['renders'].append({'object':name,'file':str(out/filename),'boundCenter':list(center),'dimensions':list(o.dimensions),'cameraLocation':list(camera.location),'cameraRotation':list(camera.rotation_euler),'orthoScale':size});s.collection.objects.unlink(o)
 (out/'render-report.json').write_text(json.dumps(report,indent=2));print('RENDERED',name,'MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
