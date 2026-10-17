import bpy,json,resource
from pathlib import Path
p=Path('.cache/quality22/source/puttclub_luxury_resort_100ha/course.blend').resolve()
print('Imported bpy; peak MB',resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,flush=True)
with bpy.data.libraries.load(str(p),link=False)as(src,dst):
 index={k:list(getattr(src,k))for k in ['objects','meshes','materials','collections','worlds','cameras','lights','node_groups','scenes']}
Path('audit/quality22/blend-library-index.json').write_text(json.dumps(index,indent=2));print({k:len(v)for k,v in index.items()},flush=True);print('Collections',index['collections'],flush=True);print('Objects sample',index['objects'][:30],flush=True);print('Worlds',index['worlds'],'cameras',index['cameras'],flush=True)
