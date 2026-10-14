from pathlib import Path
import numpy as np
from PIL import Image
S=2048;root=Path(__file__).resolve().parent.parent;V=[];UV=[];F=[];T=[];g=''
for l in (root/'character-source/base.obj').read_text().splitlines():
 a=l.split()
 if not a:continue
 if a[0]=='v':V.append(list(map(float,a[1:4])))
 elif a[0]=='vt':UV.append(list(map(float,a[1:3])))
 elif a[0]=='g':g=a[1]
 elif a[0]=='f' and g=='body':
  ids=[p.split('/') for p in a[1:]];F.append([int(p[0])-1 for p in ids]);T.append([int(p[1])-1 for p in ids])
V=np.array(V,float);UV=np.array(UV,float)
for name,k in [('caucasian-male-young.target',1),('universal-male-young-maxmuscle-averageweight.target',.6)]:
 for l in (root/'character-source'/name).read_text().splitlines():
  a=l.split()
  if len(a)==4 and a[0].isdigit():V[int(a[0])]+=np.array(list(map(float,a[1:])))*k
body=sorted(set(i for f in F for i in f));floor=V[body,1].min();scale=1.80/(V[body,1].max()-floor);V*=scale;V[:,1]-=floor*scale
# Reference-driven proportion refinement, applied to actual mesh coordinates.
headmask=np.clip((V[:,1]-1.53)/.035,0,1)*np.clip((1.72-V[:,1])/.025,0,1)
lower=np.clip((1.678-V[:,1])/.03,0,1)*headmask
V[:,1]+=(1.678-V[:,1])*.085*lower
V[:,0]*=1+.045*headmask
# Slightly smaller pinnae without scaling the skull or neck.
ear=(np.abs(V[:,0])>.081)&(V[:,1]>1.60)&(V[:,1]<1.72)
V[ear,1]=1.662+(V[ear,1]-1.662)*.94

rng=np.random.default_rng(25);noise=rng.normal(0,.7,(S,S,1));atlas=np.clip(np.array([170,125,94])[None,None,:]+noise,0,255).astype('uint8')
ref=np.array(Image.open(root/'uploads/IMG_9091.png').convert('RGB'))
for f,t in zip(F,T):
 if V[f,1].max()<1.53:continue
 for i in range(1,len(f)-1):
  verts=V[[f[0],f[i],f[i+1]]];uv=UV[[t[0],t[i],t[i+1]]]*[S-1,-(S-1)]+[0,S-1]
  lo=np.maximum(np.floor(uv.min(0)).astype(int),0);hi=np.minimum(np.ceil(uv.max(0)).astype(int),S-1)
  if np.any(hi<lo):continue
  xx,yy=np.meshgrid(np.arange(lo[0],hi[0]+1),np.arange(lo[1],hi[1]+1));coords=np.stack([xx,yy],-1)
  e0=uv[1]-uv[0];e1=uv[2]-uv[0];det=e0[0]*e1[1]-e0[1]*e1[0]
  if abs(det)<1e-8:continue
  d=coords-uv[0];a=(d[...,0]*e1[1]-d[...,1]*e1[0])/det;b=(e0[0]*d[...,1]-e0[1]*d[...,0])/det;valid=(a>=-.005)&(b>=-.005)&(a+b<=1.005)
  p=verts[0]+a[...,None]*(verts[1]-verts[0])+b[...,None]*(verts[2]-verts[0]);x,y,z=p[...,0],p[...,1],p[...,2]
  pixX=np.clip(np.rint(129+x*980).astype(int),0,1535);pixY=np.clip(np.rint(714-(y-1.6884)*840).astype(int),650,880)
  blend=np.clip((z-.070)/.030,0,1)*np.clip((.080-abs(x))/.025,0,1)*np.clip((y-1.555)/.020,0,1)*np.clip((1.74-y)/.020,0,1)
  region=atlas[lo[1]:hi[1]+1,lo[0]:hi[0]+1];photo=ref[pixY,pixX]
  # Side-view portrait corrects the cheek/temple/ear rather than stretching
  # the front photograph around the entire head.
  sideX=np.clip(np.rint(324+(z+.025)*820).astype(int),310,530)
  sideY=np.clip(np.rint(714-(y-1.6884)*840).astype(int),676,855)
  sideBlend=0.0*np.clip((abs(x)-.046)/.030,0,1)*np.clip((.132-z)/.030,0,1)*np.clip((y-1.59)/.025,0,1)*np.clip((1.732-y)/.015,0,1)
  sideRGB=ref[sideY,sideX]
  sideInvalid=(sideRGB.mean(-1)>110)&((sideRGB.max(-1)-sideRGB.min(-1)<40)|(sideRGB[...,0]<sideRGB[...,1]*1.075))
  sideBlend[sideInvalid]=0
  photo=photo*(1-sideBlend[...,None])+sideRGB*sideBlend[...,None]
  blend=np.maximum(blend,sideBlend)
  # Reject cap/background pixels; they must NEVER become white cheek patches.
  saturation=photo.max(-1)-photo.min(-1)
  invalid=((photo.min(-1)>165)&(saturation<45))|((saturation<12)&(photo.mean(-1)>115))
  blend[invalid]=0
  rgb=region*(1-blend[...,None])+photo*blend[...,None]
  # Stubble wraps around the cheek and jaw instead of ending at a front plane.
  beard=(y>1.565)&(y<1.624)&(z<.135)&(abs(x)>.04)
  rgb[beard]=rgb[beard]*.88+np.array([44,33,24])*.12
  region[valid]=np.clip(rgb[valid],0,255).astype('uint8')
Image.fromarray(atlas).save(root/'character-source/skin-atlas.png',optimize=True)
x,y=np.meshgrid(np.arange(256),np.arange(256));norm=np.stack([128+7*np.sin(x*2.1),128+7*np.sin(y*2.1),np.ones_like(x)*254],-1).astype('uint8');Image.fromarray(norm).save(root/'character-source/weave-normal.png')
print('Baked anatomical UV skin atlas, 2048px, no body photo projection.')
