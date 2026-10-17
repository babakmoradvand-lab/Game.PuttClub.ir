import bpy,json,resource,numpy as np
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True);bpy.context.preferences.filepaths.use_scripts_auto_execute=False
p=Path('.cache/quality22/source/puttclub_luxury_resort_100ha/course.blend').resolve()
with bpy.data.libraries.load(str(p),link=False)as(src,dst):dst.scenes=list(src.scenes)
print('Scene library loaded without activation MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
s=next(s for s in bpy.data.scenes if s.name!='Scene')if len(bpy.data.scenes)>1 else bpy.data.scenes[0]
# The empty startup scene may force a .001 suffix on the authored scene.
s=max(bpy.data.scenes,key=lambda s:len(s.objects))
r={'scene':{'name':s.name,'objects':len(s.objects),'engine':s.render.engine,'camera':s.camera.name if s.camera else None,'resolution':[s.render.resolution_x,s.render.resolution_y,s.render.resolution_percentage],'viewTransform':s.view_settings.view_transform,'look':s.view_settings.look,'exposure':s.view_settings.exposure,'gamma':s.view_settings.gamma,'frame':s.frame_current,'cyclesSamples':s.cycles.samples},'colors':[],'materials':[],'groups':[],'worlds':[]}
props=['attribute_name','layer_name','sky_type','sun_elevation','sun_rotation','altitude','air_density','dust_density','ozone_density','sun_intensity','sun_disc','projection','projection_blend','interpolation','extension','operation','data_type','blend_type','mode']
def node(n):
 d={'name':n.name,'type':n.bl_idname,'inputs':[]}
 for i,v in enumerate(n.inputs):
  if hasattr(v,'default_value'):
   value=v.default_value
   try:value=list(value)
   except:pass
   d['inputs'].append({'index':i,'name':v.name,'value':value,'linked':v.is_linked})
 for p in props:
  if hasattr(n,p):d[p]=getattr(n,p)
 if n.type=='TEX_IMAGE':d['image']=n.image.name if n.image else None
 if hasattr(n,'color_ramp'):d['ramp']=[{'position':e.position,'color':list(e.color)}for e in n.color_ramp.elements]
 return d
for m in bpy.data.materials:
 if m.node_tree:r['materials'].append({'name':m.name,'nodes':[node(n)for n in m.node_tree.nodes],'links':[{'from':[l.from_node.name,l.from_socket.name],'to':[l.to_node.name,l.to_socket.name]}for l in m.node_tree.links]})
for g in bpy.data.node_groups:r['groups'].append({'name':g.name,'nodes':[node(n)for n in g.nodes],'links':[{'from':[l.from_node.name,l.from_socket.name],'to':[l.to_node.name,l.to_socket.name]}for l in g.links]})
for w in bpy.data.worlds:
 if w.node_tree:r['worlds'].append({'name':w.name,'nodes':[node(n)for n in w.node_tree.nodes]})
for o in bpy.data.objects:
 if o.type=='MESH'and(o.name.startswith(('Green_01','Fairway_01','Tee_01','Rough_Tier','Conceptual','Forest_Perimeter','Central_Lake','Pond_','BK08_SCALLOPED_L_TERRAIN'))):
  colors=[]
  for a in o.data.color_attributes:
   v=np.empty(len(a.data)*4,dtype='f4');a.data.foreach_get('color',v);v=v.reshape(-1,4);colors.append({'name':a.name,'domain':a.domain,'type':a.data_type,'min':v.min(0).tolist(),'max':v.max(0).tolist(),'mean':v.mean(0).tolist()})
  r['colors'].append({'object':o.name,'materials':[m.name for m in o.data.materials if m],'activeColor':o.data.color_attributes.active_color_name,'renderColor':o.data.color_attributes[o.data.color_attributes.render_color_index].name if len(o.data.color_attributes)else None,'colors':colors,'uv':list(o.data.uv_layers.keys())})
Path('audit/quality22/source-details.json').write_text(json.dumps(r,indent=2,default=str));print(json.dumps(r['scene'],indent=2),flush=True);print('Colors',r['colors'][:4],flush=True);print('Completed; MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
