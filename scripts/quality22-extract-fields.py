"""Read authored named fields without evaluating the source scene. No runtime changes."""
import bpy,numpy as np,json,hashlib
from pathlib import Path
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.use_scripts_auto_execute=False
source=Path('.cache/quality22/source/puttclub_luxury_resort_100ha/course.blend').resolve()
with bpy.data.libraries.load(str(source),link=False)as(src,dst):dst.objects=list(src.objects)
arrays={};meta=[]
for o in bpy.data.objects:
 if o.type!='MESH':continue
 mesh=o.data;selected=[a for a in mesh.attributes if a.name in ['GrassColor','Terrain_Display_Color','lake_depth','turf_mask','cup_mask']]
 if not selected:continue
 k=f'm{len(meta):03d}';v=np.empty(len(mesh.vertices)*3,dtype='f4');mesh.vertices.foreach_get('co',v);arrays[k+'_positions']=v.reshape(-1,3)
 # Match Blender's evaluated base topology, without geometry-node instances or subdivision.
 mesh.calc_loop_triangles();tri=np.empty(len(mesh.loop_triangles)*3,dtype='i4');mesh.loop_triangles.foreach_get('vertices',tri);arrays[k+'_triangles']=tri.reshape(-1,3)
 rec={'key':k,'object':o.name,'materials':[m.name for m in mesh.materials if m],'fields':[]}
 for i,a in enumerate(selected):
  if a.data_type in ['FLOAT_COLOR','BYTE_COLOR']:width=4;prop='color'
  elif a.data_type=='FLOAT':width=1;prop='value'
  else:continue
  arr=np.empty(len(a.data)*width,dtype='f4');a.data.foreach_get(prop,arr);arr=arr.reshape(-1,width);ak=k+f'_a{i}';arrays[ak]=arr
  rec['fields'].append({'key':ak,'name':a.name,'domain':a.domain,'type':a.data_type,'count':len(arr)})
 meta.append(rec)
np.savez_compressed('audit/quality22/authored-fields.npz',**arrays)
p=Path('audit/quality22/authored-fields.npz')
Path('audit/quality22/authored-fields-index.json').write_text(json.dumps({'sourceZipSHA256':'3594f0288472a6a84d3748a721a84b1fff691a85a480fed54a4a937fb11bc279','fileSHA256':hashlib.sha256(p.read_bytes()).hexdigest(),'coordinateSystem':'Blender Z-up local; transform to glTF Y-up only at integration','scope':'unaltered base-mesh named fields; no geometry-node or subdivision evaluation; not a completed rebuild','objects':meta},indent=2))
print('Extracted',len(meta),'objects;',p.stat().st_size,'bytes')
