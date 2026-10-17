"""Bake a one-square-metre crop of the ORIGINAL green Geometry Nodes.
No density reduction: keeps authored 12,000 instances/m². This is a local material
reference/bake, not a complete-course reference render and not a gameplay change.
"""
import bpy,bmesh,json,resource,numpy as np,OpenEXR
from pathlib import Path
from mathutils import Vector
from PIL import Image
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
root=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve()
with bpy.data.libraries.load(str(root/'course.blend'),link=False)as(src,dst):dst.scenes=list(src.scenes)
original=max(bpy.data.scenes,key=lambda s:len(s.objects));source=bpy.data.objects['Green_01_Turf_GG01'];o=source.copy();o.data=source.data.copy()
# Choose an interior point offset from the actual cup; keep original XY field coordinates.
v=np.array([v.co[:]for v in source.data.vertices]);cx,cy=v[:,:2].mean(0)+np.array([2.,0.]);half=.5
bm=bmesh.new();bm.from_mesh(o.data)
for co,no in [((cx-half,0,0),(-1,0,0)),((cx+half,0,0),(1,0,0)),((0,cy-half,0),(0,-1,0)),((0,cy+half,0),(0,1,0))]:
 bmesh.ops.bisect_plane(bm,geom=list(bm.verts)+list(bm.edges)+list(bm.faces),dist=1e-7,plane_co=co,plane_no=no,clear_outer=True)
bm.to_mesh(o.data);bm.free();o.data.update();assert len(o.data.polygons)>0
z=max(v.co.z for v in o.data.vertices)
s=bpy.data.scenes.new('Quality22_Original_Green_One_Metre_Bake');s.world=original.world;s.collection.objects.link(o)
sun=bpy.data.objects['Sun_Cinema_Key'].copy();s.collection.objects.link(sun)
camdata=bpy.data.cameras.new('Green_Bake_Camera');cam=bpy.data.objects.new('Green_Bake_Camera',camdata);s.collection.objects.link(cam);camdata.type='ORTHO';camdata.ortho_scale=1.;cam.location=(cx,cy,z+2);cam.rotation_euler=(0,0,0);s.camera=cam
s.render.engine='CYCLES';s.cycles.device='CPU';s.cycles.samples=32;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=512;s.render.resolution_y=512;s.render.resolution_percentage=100
s.render.image_settings.media_type='MULTI_LAYER_IMAGE';s.render.image_settings.file_format='OPEN_EXR_MULTILAYER';s.render.image_settings.color_depth='32'
s.view_settings.view_transform=original.view_settings.view_transform;s.view_settings.look=original.view_settings.look;s.view_settings.exposure=original.view_settings.exposure
s.view_layers[0].use_pass_normal=True;s.view_layers[0].use_pass_diffuse_color=True;s.view_layers[0].use_pass_ambient_occlusion=True
out=Path('audit/quality22/reference');out.mkdir(parents=True,exist_ok=True);exr=Path('.cache/quality22/green-original-multilayer.exr').resolve();s.render.filepath=str(exr)
bpy.context.window.scene=s
print('Starting authored-density green crop',len(o.data.vertices),'vertices; location',cx,cy,z,flush=True)
bpy.ops.render.render(write_still=True,scene=s.name)
s.render.image_settings.media_type='IMAGE';s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';bpy.data.images['Render Result'].save_render(str((out/'source-green-one-metre.png').resolve()),scene=s)
files=[]
report={'scope':'1 m² original green crop only; original 12000/m² density; original shader/grass prototypes/sun/world; Cycles CPU replaces Eevee; no claim of a complete original-course render','sourceObject':source.name,'cropCenterXY':[cx,cy],'cropSizeM':1,'samples':32,'resolution':[512,512],'viewTransform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure,'files':files,'peakMB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024}
(out/'green-bake-report.json').write_text(json.dumps(report,indent=2));print('DONE',report,flush=True)

exec(Path('scripts/quality22-extract-bake-passes.py').read_text())
