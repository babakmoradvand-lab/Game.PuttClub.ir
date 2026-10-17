"""Make sparse grass LODs compositable, not black where the original GN emits
instances only. Those pixels retain the actual underlying master-terrain shader.
"""
import OpenEXR,numpy as np,json
from pathlib import Path
from PIL import Image
out=Path('public/courses/puttclub/native');p=out/'source.json';spec=json.loads(p.read_text());groups=json.load(open('audit/quality22/source-details.json'))['groups'];gmap={x['name']:x for x in groups}
def periodic(a,normal=False):
 h,w=a.shape[:2];y,x=np.mgrid[0:h,0:w];d=np.minimum.reduce([x,w-1-x,y,h-1-y]);f=np.clip(d/24,0,1);f=f*f*(3-2*f);a=a*f[:,:,None]+np.roll(a,(h//2,w//2),(0,1))*(1-f[:,:,None])
 if normal:a/=np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-8)
 return a
for mat,m in spec['grassMicro'].items():
 key=m['key'];f=OpenEXR.File('.cache/quality22/'+('green-original-multilayer.exr'if key=='green'else'grass-'+key+'.exr'));data={}
 for part in f.parts:
  name=part.header.get('name','')
  if'Normal'in name:data['normal']=np.stack([next(c.pixels for k,c in part.channels.items()if k.endswith('.'+axis))for axis in'XYZ'],-1)
  elif'Diffuse Color'in name:data['color']=next(iter(part.channels.values())).pixels[:,:,:3]
  elif'Ambient Occlusion'in name:data['ao']=next(iter(part.channels.values())).pixels[:,:,:3]
 hit=np.linalg.norm(data['normal'],axis=2)>.1;coverage=periodic(hit[:,:,None].astype('f4'))[:,:,0];base=np.array(m['baseColor']);color=data['color'].copy();color[~hit]=base;ratio=periodic(color)/np.maximum(base,1e-5);gain=max(1.,float(np.ceil(np.percentile(ratio,99.99))));rgb=np.clip(ratio/gain,0,1);rgba=np.concatenate([rgb,coverage[:,:,None]],2);Image.fromarray(np.round(rgba*255).astype('uint8')).save(out/(key+'-micro-color.png'))
 if key!='green':
  normals=data['normal'].copy();normals[~hit]=[0,0,1];normal=periodic(normals,True)*.5+.5;Image.fromarray(np.round(np.clip(normal,0,1)*255).astype('uint8')).save(out/(key+'-micro-normal.png'))
 ao=data['ao'].copy();ao[~hit]=1;ao=periodic(ao);Image.fromarray(np.round(np.clip(ao,0,1)*255).astype('uint8')).save(out/(key+'-micro-ao.png'))
 m['gain']=gain;m['geometryCoverage']=float(hit.mean());m['compositeMasterTerrain']=key in['rough','heavy','native'];m['note']='Sparse-instance-only GN output is composited over original master-terrain colors/textures, not a black plane'if m['compositeMasterTerrain']else'Original GN includes the ground mesh'
p.write_text(json.dumps(spec,separators=(',',':')));(out/'grass-micro.json').write_text(json.dumps(spec['grassMicro'],indent=2));print([(k,m['geometryCoverage'])for k,m in spec['grassMicro'].items()])
