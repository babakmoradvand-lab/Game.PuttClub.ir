"""Refine the actual published GLB without re-exporting/retargeting its skeleton.
All old joints, inverse-bind matrices and five animation channel arrays are kept.
Native coordinates are metres: +Y up, +Z front, +X anatomical left.
"""
from pathlib import Path
import json,struct,math,io,hashlib
import numpy as np
from PIL import Image,ImageFilter
ROOT=Path(__file__).resolve().parent.parent
SOURCE=ROOT/'.cache/scale12-release/pro_golfer_character.glb'
if not SOURCE.exists():
 import urllib.request
 SOURCE=ROOT/'.cache/character-inputs/look17.glb';SOURCE.parent.mkdir(parents=True,exist_ok=True)
 if not SOURCE.exists():
  urllib.request.urlretrieve('https://raw.githubusercontent.com/babakmoradvand-lab/Game.PuttClub.ir/44f60c658bb320103db3692700e4704655802775/pro_golfer_character.glb',SOURCE)
OUT=(ROOT/'public' if (ROOT/'public/index.html').exists() else ROOT)/'pro_golfer_character.glb'
b=SOURCE.read_bytes();jl=struct.unpack_from('<I',b,12)[0]
j=json.loads(b[20:20+jl]);buf=bytearray(b[28+jl:]);dtype={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'};size={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(ai):
 a=j['accessors'][ai];v=j['bufferViews'][a['bufferView']];d=np.dtype(dtype[a['componentType']]);c=size[a['type']];offset=v.get('byteOffset',0)+a.get('byteOffset',0)
 assert not v.get('byteStride')or v['byteStride']==d.itemsize*c
 return np.frombuffer(buf,dtype=d,count=a['count']*c,offset=offset).reshape(a['count'],c).copy()
def block(data,target=None):
 while len(buf)%4:buf.append(0)
 offset=len(buf);buf.extend(data);v={'buffer':0,'byteOffset':offset,'byteLength':len(data)}
 if target:v['target']=target
 j['bufferViews'].append(v);return len(j['bufferViews'])-1
def add(a,typ,component=5126,target=34962):
 a=np.asarray(a,dtype=dtype[component]);a=a.reshape(-1,size[typ]);v=block(a.tobytes(),target);desc={'bufferView':v,'componentType':component,'count':len(a),'type':typ}
 if typ=='VEC3':desc.update(min=a.min(0).astype(float).tolist(),max=a.max(0).astype(float).tolist())
 j['accessors'].append(desc);return len(j['accessors'])-1
head=next(k for k,n in enumerate(j['skins'][0]['joints'])if j['nodes'][n]['name']=='Head')
chest=next(k for k,n in enumerate(j['skins'][0]['joints'])if j['nodes'][n]['name']=='Chest')
def primitive(name):return next(j['meshes'][n['mesh']]['primitives'][0]for n in j['nodes']if n.get('name')==name)
def normals(pos,ind):
 norm=np.zeros_like(pos);v=np.cross(pos[ind[:,1]]-pos[ind[:,0]],pos[ind[:,2]]-pos[ind[:,0]])
 for k in range(3):np.add.at(norm,ind[:,k],v)
 # Smooth UV duplicates as well, avoiding new bright sleeve seams.
 _,groups=np.unique(np.round(pos,5),axis=0,return_inverse=True);sm=np.zeros((groups.max()+1,3),np.float32);np.add.at(sm,groups,norm);norm=sm[groups]
 norm/=np.maximum(np.linalg.norm(norm,axis=1,keepdims=True),1e-12);return norm
class Geometry:
 def __init__(self):self.p=[];self.f=[];self.uv=[]
 def surface(self,rows,cols,func,wrap=False):
  start=len(self.p)
  for r in range(rows):
   for k in range(cols):self.p.append(func(r/(rows-1),k/(cols if wrap else cols-1)));self.uv.append([k/(cols if wrap else cols-1),r/(rows-1)])
  for r in range(rows-1):
   for k in range(cols if wrap else cols-1):
    a=start+r*cols+k;c=start+(r+1)*cols+k;bn=start+r*cols+(k+1)%cols;d=start+(r+1)*cols+(k+1)%cols
    self.f.extend([[a,bn,c],[bn,d,c]])
 def tube(self,points,radius,segments=6):
  start=len(self.p);points=np.array(points,float)
  for i,p in enumerate(points):
   d=points[min(i+1,len(points)-1)]-points[max(0,i-1)];d/=max(np.linalg.norm(d),1e-9);u=np.cross(d,[0,1,0])
   if np.linalg.norm(u)<.01:u=np.cross(d,[1,0,0])
   u/=np.linalg.norm(u);v=np.cross(d,u)
   for k in range(segments):self.p.append(p+radius*(u*math.cos(k*math.tau/segments)+v*math.sin(k*math.tau/segments)));self.uv.append([k/segments,i/max(1,len(points)-1)])
  for i in range(len(points)-1):
   for k in range(segments):
    a=start+i*segments+k;bb=start+i*segments+(k+1)%segments;c=a+segments;d=bb+segments;self.f.extend([[a,bb,c],[bb,d,c]])
 def append(self,prim,remove,bone):
  attrs={k:read(ai)for k,ai in prim['attributes'].items()};pos=attrs['POSITION'];idx=read(prim['indices']).reshape(-1,3);keep=idx[~remove]
  used=np.unique(keep);remap=np.full(len(pos),-1);remap[used]=np.arange(len(used));keep=remap[keep]
  newp=np.array(self.p,np.float32);newf=np.array(self.f,np.int64);newn=normals(newp,newf);n=len(newp)
  extra={'POSITION':newp,'NORMAL':newn,'TEXCOORD_0':np.array(self.uv,np.float32),'JOINTS_0':np.tile([bone,0,0,0],(n,1)),'WEIGHTS_0':np.tile([1.,0,0,0],(n,1))}
  for key,old in attrs.items():
   if key=='TANGENT':continue
   if key.startswith('TEXCOORD_'):extra[key]=np.array(self.uv,np.float32)
   assert key in extra,key
   a=np.concatenate([old[used],extra[key]]);typ={2:'VEC2',3:'VEC3',4:'VEC4'}[a.shape[1]];component=5123 if key=='JOINTS_0'else 5126
   prim['attributes'][key]=add(a,typ,component)
  prim['attributes'].pop('TANGENT',None);prim['indices']=add(np.concatenate([keep,newf+len(used)]).reshape(-1,1),'SCALAR',5125,34963)
  return {'oldVertices':len(pos),'retainedVertices':len(used),'newVertices':n,'removedTriangles':int(remove.sum())}
# True cap geometry, removing the raycast rim's centre notch; no rescale of person.
cap=Geometry()
def crown(t,u):
 theta=t*math.pi/2;phi=u*math.tau;rim=1.719+.008*math.sin(phi)
 return [.094*math.sin(theta)*math.cos(phi),rim+(1.824-rim)*math.cos(theta),.063+.111*math.sin(theta)*math.sin(phi)]
cap.surface(19,64,crown,True)
def brim(t,u):
 a=.50+u*(math.pi-1.0);sin=math.sin(a);x=.094*math.cos(a);z=.063+.111*sin;length=.020+.056*(max(0,sin)**3)
 return [x*(1+.055*t),1.719+.008*sin-.003-.010*t*t+.004*(abs(math.cos(a))**2)*t,z+length*t]
cap.surface(9,49,brim)
# Close the visor with a thin underside, not a one-sided white card.
cap.surface(9,49,lambda t,u:[brim(t,1-u)[0],brim(t,1-u)[1]-.0025,brim(t,1-u)[2]])
for k in range(6):cap.tube([np.array(crown(t,k/6))+[0,.0005,0]for t in np.linspace(.03,1,20)],.00045)
cap.tube([np.array(brim(1,u))+[0,0,.0005]for u in np.linspace(0,1,49)],.0008)
# Top button and a real rear strap.
cap.surface(7,16,lambda t,u:[.006*math.sin(t*math.pi)*math.cos(u*math.tau),1.824+.0025*math.cos(t*math.pi),.063+.006*math.sin(t*math.pi)*math.sin(u*math.tau)],True)
cap.surface(2,17,lambda t,u:[-.035+.07*u,1.709+.012*t,-.048])
p=primitive('White leather / cap accessories');a=p['attributes'];ids=read(a['JOINTS_0']);w=read(a['WEIGHTS_0']);headw=((ids==head)*w).sum(1);ind=read(p['indices']).reshape(-1,3);remove=np.all(headw[ind]>.99,axis=1);capstats=cap.append(p,remove,head)
# The folded polo collar is one constructed loft (not separate triangular cards).
p=primitive('Navy woven tour polo accessories');pos=read(p['attributes']['POSITION']);ind=read(p['indices']).reshape(-1,3)
# Separate connected accessory components without touching the main shirt.
parent=np.arange(len(pos))
def find(x):
 while parent[x]!=x:parent[x]=parent[parent[x]];x=parent[x]
 return int(x)
for tri in ind:
 r=find(int(tri[0]))
 for x in tri[1:]:parent[find(int(x))]=r
labels=np.array([find(i)for i in range(len(pos))]);bad=set()
for label in np.unique(labels):
 points=pos[labels==label]
 if len(points)<2000 and points[:,1].min()>1.38 and np.max(np.abs(points[:,0]))<.125:bad.add(label)
remove=np.array([labels[tri[0]]in bad for tri in ind]);collar=Geometry()
def fold(t,u):
 # Back and sides meet two pointed front ends, with a 58-degree opening.
 phi=math.pi/2+.50+u*(math.tau-1.0);front=max(0,math.sin(phi));edge=abs(u-.5)*2
 profile=np.array([[.078,1.526,.070],[.081,1.547,.073],[.094,1.539,.086],[.108,1.500,.100]])
 rr=t*3;v=min(2,int(rr));f=rr-v;rx,y,rz=profile[v]*(1-f)+profile[v+1]*f
 x=rx*math.cos(phi);z=.014+rz*math.sin(phi)
 point=(max(0,(edge-.78)/.22)**2)*t*t
 x=x*(1-point)+math.copysign(.026,x)*point;y-=.016*point;z+=.035*point
 return [x,y,z]
collar.surface(13,65,fold)
collar.surface(13,65,lambda t,u:[fold(t,1-u)[0],fold(t,1-u)[1]-.0017,fold(t,1-u)[2]])
# A raised, cloth-width placket that lies on the chest.
collar.surface(7,3,lambda t,u:[-.011+.022*u,1.488-.088*t,.143-.010*t])
collarstats=collar.append(p,remove,chest)
# Small sewn/folded fabric displacement, in metres. No change to body/leg lengths.
for name,kind in [('Navy woven tour polo accessories','shirt'),('Ivory grey tailored trousers accessories','pants')]:
 p=primitive(name);v=read(p['attributes']['POSITION']);x,y,z=v.T
 if kind=='shirt':
  area=(y>1.045)&(y<1.28)&(np.abs(x)<.21)
  dz=.0022*np.sin(y*100+x*30)*np.exp(-((y-1.105)/.075)**2);v[area,2]+=dz[area]
 else:
  area=(y>.14)&(y<.85);dz=.0015*np.sin(y*105+x*30)*(np.exp(-((y-.21)/.075)**2)+.7*np.exp(-((y-.55)/.09)**2));v[area,2]+=dz[area]
 ind=read(p['indices']).reshape(-1,3);p['attributes']['POSITION']=add(v,'VEC3');p['attributes']['NORMAL']=add(normals(v,ind),'VEC3');p['attributes'].pop('TANGENT',None)
# Actual cloth sample used only as de-lit microtexture, not a body photograph.
if (ROOT/'uploads/IMG_9091.png').exists():
 im=Image.open(ROOT/'uploads/IMG_9091.png').convert('RGB').crop((1390,640,1495,725)).resize((256,256),Image.Resampling.LANCZOS)
 g=np.array(im.convert('L'),float);smooth=np.array(im.convert('L').filter(ImageFilter.GaussianBlur(8)),float);detail=np.clip(g-smooth,-14,14)
 tile=np.clip(242+detail*.62,220,254).astype('uint8');rgb=np.repeat(tile[:,:,None],3,2);bio=io.BytesIO();Image.fromarray(rgb).save(bio,format='PNG',optimize=True)
else:
 bio=io.BytesIO((ROOT/'character-source/fabric-microdetail.png').read_bytes())
(ROOT/'character-source/fabric-microdetail.png').write_bytes(bio.getvalue())
j.setdefault('images',[]).append({'name':'Reference fabric microdetail — de-lit','mimeType':'image/png','bufferView':block(bio.getvalue())});ii=len(j['images'])-1
j.setdefault('samplers',[]).append({'magFilter':9729,'minFilter':9987,'wrapS':10497,'wrapT':10497});si=len(j['samplers'])-1
j.setdefault('textures',[]).append({'source':ii,'sampler':si});ti=len(j['textures'])-1
for m in j['materials']:
 if m.get('name')in['Navy woven tour polo','Ivory grey tailored trousers']:
  pb=m['pbrMetallicRoughness'];pb['baseColorTexture']={'index':ti,'extensions':{'KHR_texture_transform':{'scale':[48,48]}}};pb['baseColorFactor']=[min(1,x*1.06)for x in pb.get('baseColorFactor',[1,1,1,1])[:3]]+[1]
  if 'normalTexture'in m:m['normalTexture']['extensions']={'KHR_texture_transform':{'scale':[12,12]}}
j.setdefault('extensionsUsed',[]).append('KHR_texture_transform')
j.setdefault('asset',{}).setdefault('extras',{}).update(character_revision='detail18',body_height_metres=1.80,scale_policy='Original joint and mesh units retained; do not scale the athlete between shots.')
j['buffers'][0]['byteLength']=len(buf)
js=json.dumps(j,separators=(',',':')).encode();js+=b' '*((-len(js))%4);buf+=b'\0'*((-len(buf))%4)
out=b'glTF'+struct.pack('<II',2,12+8+len(js)+8+len(buf))+struct.pack('<I4s',len(js),b'JSON')+js+struct.pack('<I4s',len(buf),b'BIN\0')+buf
OUT.write_bytes(out)
# Verify the byte arrays driving every joint and clip are unchanged.
original=json.loads(b[20:20+jl]);ob=b[28+jl:]
for skin in original['skins']:assert j['skins'][0]==skin
assert j['nodes']==original['nodes'] and j['animations']==original['animations']
for a in original['animations']:
 for sm in a['samplers']:
  for key in ['input','output']:
   ai=sm[key];ac=original['accessors'][ai];view=original['bufferViews'][ac['bufferView']];off=view.get('byteOffset',0);length=view['byteLength'];assert ob[off:off+length]==buf[off:off+length]
stats={'revision':'detail18','cap':capstats,'collar':collarstats,'skeletonAndAnimationBytesUnchanged':True,'bytes':len(out),'sha256':hashlib.sha256(out).hexdigest()}
(ROOT/'audit/character12').mkdir(parents=True,exist_ok=True)
(ROOT/'audit/character12/model-edit.json').write_text(json.dumps(stats,indent=2));print(json.dumps(stats,indent=2))
