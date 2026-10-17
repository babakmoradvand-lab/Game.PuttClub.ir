"""Read original .blend without running embedded scripts; no source-file changes."""
import bpy,json,collections
from pathlib import Path
source=Path('.cache/quality22/source/puttclub_luxury_resort_100ha/course.blend').resolve()
bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
s=bpy.context.scene
report={'blender':bpy.app.version_string,'source':str(source.name),'scene':s.name,'engine':s.render.engine,'resolution':[s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage],'camera':s.camera.name if s.camera else None,'world':s.world.name if s.world else None,'viewTransform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure,'objectTypes':dict(collections.Counter(o.type for o in bpy.data.objects)),'collections':[c.name for c in bpy.data.collections],'images':[{'name':i.name,'size':list(i.size),'path':i.filepath,'packed':bool(i.packed_file)}for i in bpy.data.images],'materials':[],'cameras':[]}
for m in bpy.data.materials:
 item={'name':m.name,'users':m.users,'nodes':[]}
 if m.node_tree:
  for n in m.node_tree.nodes:
   d={'name':n.name,'type':n.bl_idname}
   if n.type=='TEX_IMAGE':d['image']=n.image.name if n.image else None
   if n.type=='GROUP':d['group']=n.node_tree.name if n.node_tree else None
   if n.type=='BSDF_PRINCIPLED':d['defaults']={i.name:(list(i.default_value)if hasattr(i.default_value,'__len__')and not isinstance(i.default_value,str)else i.default_value)for i in n.inputs if not i.is_linked and hasattr(i,'default_value')}
   item['nodes'].append(d)
 report['materials'].append(item)
for o in bpy.data.objects:
 if o.type=='CAMERA':report['cameras'].append({'name':o.name,'location':list(o.location),'rotation':list(o.rotation_euler),'lens':o.data.lens})
Path('audit/quality22/blend-inspection.json').write_text(json.dumps(report,indent=2,default=str));print(json.dumps({k:report[k]for k in ['blender','engine','resolution','camera','viewTransform','look','objectTypes']},indent=2),flush=True);print('Materials',len(report['materials']),'images',len(report['images']),'cameras',len(report['cameras']),flush=True)
