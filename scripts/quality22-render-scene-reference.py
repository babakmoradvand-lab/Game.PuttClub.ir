"""Documented base-LOD original scene reference; not a full-detail Eevee render.
Disables dense grass GN/subdivision before activation to fit 2 GB. Retains authored
terrain, materials, scene camera/world/sun, tree and nature scatter instances.
"""
import bpy,json,resource
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
root=Path('.cache/quality22/source/puttclub_luxury_resort_100ha').resolve()
with bpy.data.libraries.load(str(root/'course.blend'),link=False)as(a,b):b.scenes=list(a.scenes)
s=max(bpy.data.scenes,key=lambda s:len(s.objects));disabled=[]
for o in s.objects:
 for m in o.modifiers:
  if m.type=='SUBSURF'or(m.type=='NODES'and not m.node_group.name.startswith('GN_')):
   disabled.append({'object':o.name,'modifier':m.name,'reason':'base-LOD reference: no dense physical grass/subdivision'});m.show_render=False;m.show_viewport=False
for im in bpy.data.images:
 p=Path('.cache/quality22/recovered-textures')/im.name
 if not im.packed_file and p.exists():im.filepath=str(p.resolve())
s.render.engine='CYCLES';s.cycles.samples=8;s.cycles.use_denoising=True;s.render.threads_mode='FIXED';s.render.threads=2
s.render.resolution_x=960;s.render.resolution_y=540;s.render.resolution_percentage=100;s.render.image_settings.media_type='IMAGE';s.render.image_settings.file_format='PNG'
Path('audit/quality22/reference').mkdir(parents=True,exist_ok=True);s.render.filepath=str(Path('audit/quality22/reference/source-scene-base-lod.png').resolve())
print('Activating documented base-LOD scene; disabled',len(disabled),'modifiers',flush=True);bpy.context.window.scene=s
bpy.ops.render.render(write_still=True,scene=s.name)
Path('audit/quality22/reference/scene-reference-report.json').write_text(json.dumps({'scope':'Original full scene with dense grass GN and subdivision disabled (base LOD), Cycles CPU8 instead of original Eevee; NOT full-detail/pixel-identical reference','camera':s.camera.name,'view':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure,'disabled':disabled,'peakMB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024},indent=2));print('REFERENCE DONE',flush=True)
