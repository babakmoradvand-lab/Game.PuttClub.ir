from pathlib import Path
import numpy as np,json
from PIL import Image
out=Path('public/courses/puttclub/native');ref=Path('audit/quality22/reference');r=json.load(open(ref/'green-bake-report.json'));data=np.load('.cache/quality22/all-source-fields.npz');idx=next(x for x in json.load(open('.cache/quality22/all-source-fields.json'))if x['name']=='Green_01_Turf_GG01');v=data[idx['key']+'_position'];t=data[idx['key']+'_tri'];center=np.array(r['cropCenterXY']);ti=np.argmin(np.linalg.norm(v[t].mean(1)[:,:2]-center,axis=1));p=v[t[ti]];n=np.cross(p[1]-p[0],p[2]-p[0]);n/=np.linalg.norm(n);n*=1 if n[2]>0 else-1;tan=np.array([1.,0,0])-n*n[0];tan/=np.linalg.norm(tan);bit=np.cross(n,tan)
def periodic(a,normal=False):
 h,w=a.shape[:2];y,x=np.mgrid[0:h,0:w];d=np.minimum.reduce([x,w-1-x,y,h-1-y]);f=np.clip(d/24,0,1);f=f*f*(3-2*f);a=a*f[:,:,None]+np.roll(a,(h//2,w//2),(0,1))*(1-f[:,:,None])
 if normal:a/=np.maximum(np.linalg.norm(a,axis=2,keepdims=True),1e-8)
 return a
ar=np.array(Image.open(ref/'source-green-normal.png'))/255*2-1;ar=np.stack([ar@tan,ar@bit,ar@n],-1);ar=periodic(ar,True);Image.fromarray(np.round(np.clip(ar*.5+.5,0,1)*255).astype('uint8')).save(out/'green-micro-normal.png')
a=np.array(Image.open(ref/'source-green-diffuse-linear.png'))/255.;mean=a.mean((0,1));a=periodic(a)/np.maximum(mean,1e-5)/2;Image.fromarray(np.round(np.clip(a,0,1)*255).astype('uint8')).save(out/'green-micro-color.png')
a=np.array(Image.open(ref/'source-green-ao-linear.png'))/255.;a=periodic(a);Image.fromarray(np.round(np.clip(a,0,1)*255).astype('uint8')).save(out/'green-micro-ao.png')
(out/'green-micro.json').write_text(json.dumps({'source':'Original Green_01 Geometry Nodes at 12000/m², 1 m crop, Cycles32 reference','normalBasisCorrection':{'T':tan.tolist(),'B':bit.tolist(),'N':n.tolist()},'periodicBorders':'24 px same-field shifted blend; normals renormalized','colorModulationGain':2,'sourceDiffuseMean':mean.tolist(),'tileSizeM':1},indent=2))
print('Source-derived green micro textures ready')
