"""Inspect original Blender datablocks without evaluating the heavy scene."""
import bpy,json,resource
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
p=Path('.cache/quality22/source/puttclub_luxury_resort_100ha/course.blend').resolve()
with bpy.data.libraries.load(str(p),link=False)as(src,dst):dst.objects=list(src.objects);dst.worlds=list(src.worlds)
print('Loaded original objects WITHOUT scene evaluation; MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
def value(v):
 try:return list(v)
 except:return v
def modifier_inputs(m):
 if m.type!='NODES'or not m.node_group:return {}
 result={}
 for socket in m.node_group.interface.items_tree:
  if getattr(socket,'in_out',None)!='INPUT':continue
  item=getattr(m.properties.inputs,socket.identifier,None)
  result[socket.name]={key:value(getattr(item,key))for key in ['value','type','attribute_name','layer_name']if item is not None and hasattr(item,key)}
 return result
report={'blender':bpy.app.version_string,'materials':[],'objects':[],'groups':[],'worlds':[],'images':[]}
for m in bpy.data.materials:
 report['materials'].append({'name':m.name,'nodes':[{'name':n.name,'type':n.bl_idname,'image':n.image.name if n.type=='TEX_IMAGE'and n.image else None,'group':n.node_tree.name if n.type=='GROUP'and n.node_tree else None,'inputs':{i.name:value(i.default_value)for i in n.inputs if hasattr(i,'default_value')}}for n in m.node_tree.nodes]if m.node_tree else [],'links':[{'from':[l.from_node.name,l.from_socket.name],'to':[l.to_node.name,l.to_socket.name]}for l in m.node_tree.links]if m.node_tree else []})
for o in bpy.data.objects:
 report['objects'].append({'name':o.name,'type':o.type,'location':list(o.location),'rotation':list(o.rotation_euler),'scale':list(o.scale),'parent':o.parent.name if o.parent else None,'hideRender':o.hide_render,'hideViewport':o.hide_viewport,'mesh':o.data.name if o.type=='MESH'else None,'vertices':len(o.data.vertices)if o.type=='MESH'else None,'materials':[s.material.name if s.material else None for s in o.material_slots],'modifiers':[{'name':m.name,'type':m.type,'group':m.node_group.name if m.type=='NODES'and m.node_group else None,'showRender':m.show_render,'showViewport':m.show_viewport,'inputs':modifier_inputs(m)}for m in o.modifiers],'lens':o.data.lens if o.type=='CAMERA'else None,'lightEnergy':o.data.energy if o.type=='LIGHT'else None})
for g in bpy.data.node_groups:
 report['groups'].append({'name':g.name,'nodes':[{'name':n.name,'type':n.bl_idname,'inputs':{i.name:value(i.default_value)for i in n.inputs if hasattr(i,'default_value')}}for n in g.nodes],'links':[{'from':[l.from_node.name,l.from_socket.name],'to':[l.to_node.name,l.to_socket.name]}for l in g.links]})
for w in bpy.data.worlds:
 report['worlds'].append({'name':w.name,'nodes':[{'name':n.name,'type':n.bl_idname,'inputs':{i.name:value(i.default_value)for i in n.inputs if hasattr(i,'default_value')}}for n in w.node_tree.nodes]if w.node_tree else []})
for i in bpy.data.images:report['images'].append({'name':i.name,'path':i.filepath,'packed':bool(i.packed_file),'size':list(i.size),'colorspace':i.colorspace_settings.name})
Path('audit/quality22/original-datablocks.json').write_text(json.dumps(report,indent=2,default=str));print('Objects',len(report['objects']),'materials',len(report['materials']),'groups',len(report['groups']),'images',len(report['images']),flush=True)
for o in report['objects']:
 if o['modifiers']:print(o['name'],o['vertices'],[(m['name'],m['group'])for m in o['modifiers']],flush=True)
