"""Extract Blender 5.2 multipart EXR data passes without applying display transforms.
Outputs are source-reference data; not runtime-ready until normal basis and tile
border handling are verified against the target renderer.
"""
import OpenEXR,numpy as np,json
from PIL import Image
from pathlib import Path
f=OpenEXR.File('.cache/quality22/green-original-multilayer.exr');out=Path('audit/quality22/reference');files=[]
for part in f.parts:
 channels=part.channels;partname=part.header.get('name','')
 if 'Normal'in partname:
  xyz=[next(c.pixels for k,c in channels.items()if k.endswith('.'+axis))for axis in 'XYZ'];n=np.stack(xyz,-1)
  rgb=np.clip(n*.5+.5,0,1);name='source-green-normal.png';Image.fromarray(np.round(rgb*255).astype('uint8')).save(out/name)
  files.append({'pass':partname,'file':name,'colorSpace':'linear normal data','normalBasis':'Blender world axes; original surface is not flattened; correct tangent basis before runtime use','meanWorldNormal':n.mean((0,1)).tolist()})
 elif any(x in partname for x in ['Diffuse Color','Ambient Occlusion']):
  a=next(iter(channels.values())).pixels
  if a.ndim==2:a=np.repeat(a[:,:,None],3,axis=2)
  rgb=np.clip(a[:,:,:3],0,1);name='source-green-'+('diffuse-linear'if'Diffuse'in partname else'ao-linear')+'.png';Image.fromarray(np.round(rgb*255).astype('uint8')).save(out/name)
  files.append({'pass':partname,'file':name,'colorSpace':'linear data, not sRGB','mean':rgb.mean((0,1)).tolist()})
rp=out/'green-bake-report.json';report=json.loads(rp.read_text());report['files']=files;report['EXRParts']=[p.header.get('name')for p in f.parts];report['runtimeReady']=False;report['remainingValidation']=['world-to-surface tangent basis conversion','periodic tile seams and mip behavior','GLB/Three.js color-space comparison','complete-scene and physical iPhone performance acceptance'];rp.write_text(json.dumps(report,indent=2));print(json.dumps(files,indent=2))
