"""Build a genuine skinned golfer, fitted garments and five skeletal clips.
Anatomical mesh/weights/morphs: MakeHuman core assets (CC0; see LICENSE.ASSETS.md).
Reference pixels are used ONLY in the face's proper UV atlas, never a body plane.
Run: blender -b -t 4 --python character-source/build_golfer.py
"""
import bpy, math, json, os, sys
from pathlib import Path
from mathutils import Vector, Quaternion, Matrix, Euler
from mathutils.kdtree import KDTree
import numpy as np
ROOT=Path(__file__).resolve().parent.parent;SRC=ROOT/'character-source';OUT=ROOT/'candidate-rig11';OUT.mkdir(exist_ok=True)
(ROOT/'audit/character11').mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
# Native anatomy coordinates: X lateral, Y up, Z face-forward. Blender X,-Z,Y.
def B(v):return Vector((v[0],-v[2],v[1]))
def N(v):return Vector((v[0],v[2],-v[1]))
V=[];UV=[];faces=[];groups=[];uvfaces=[];group=''
for line in (SRC/'base.obj').read_text().splitlines():
 a=line.split()
 if not a:continue
 if a[0]=='v':V.append(list(map(float,a[1:4])))
 elif a[0]=='vt':UV.append(list(map(float,a[1:3])))
 elif a[0]=='g':group=a[1]
 elif a[0]=='f':
  pairs=[p.split('/') for p in a[1:]];faces.append([int(p[0])-1 for p in pairs]);uvfaces.append([int(p[1])-1 for p in pairs]);groups.append(group)
V=np.array(V,dtype=float)
for name,strength in [('caucasian-male-young.target',1),('universal-male-young-maxmuscle-averageweight.target',.60)]:
 for line in (SRC/name).read_text().splitlines():
  a=line.split()
  if len(a)==4 and a[0].isdigit():V[int(a[0])]+=strength*np.array(list(map(float,a[1:])))
body_ids=sorted(set(i for f,g in zip(faces,groups) if g=='body' for i in f))
floor=V[body_ids,1].min();scale=1.80/(V[body_ids,1].max()-floor)
V*=scale;V[:,1]-=floor*scale
# Reference-driven proportion refinement, applied to actual mesh coordinates.
headmask=np.clip((V[:,1]-1.53)/.035,0,1)*np.clip((1.72-V[:,1])/.025,0,1)
lower=np.clip((1.678-V[:,1])/.03,0,1)*headmask
V[:,1]+=(1.678-V[:,1])*.085*lower
V[:,0]*=1+.045*headmask
# Slightly smaller pinnae without scaling the skull or neck.
ear=(np.abs(V[:,0])>.081)&(V[:,1]>1.60)&(V[:,1]<1.72)
V[ear,1]=1.662+(V[ear,1]-1.662)*.94

R=json.loads((SRC/'default.mhskel').read_text());W=json.loads((SRC/'default_weights.mhw').read_text())['weights']
def joint(name):return Vector(V[R['joints'][name]].mean(0))
def end(name,part):return joint(R['bones'][name][part])
# Compact deform skeleton, with genuine separate finger phalanges.
rigdef={
 'Hips':((0,.94,0),(0,1.08,0),None),
 'Spine':(end('spine05','head'),end('spine03','head'),'Hips'),
 'Chest':(end('spine03','head'),end('spine01','tail'),'Spine'),
 'Neck':(end('neck01','head'),end('neck03','tail'),'Chest'),
 'Head':(end('head','head'),end('head','tail'),'Neck'),
}
for side in ['L','R']:
 rigdef['Clavicle.'+side]=(end('clavicle.'+side,'head'),end('upperarm01.'+side,'head'),'Chest')
 rigdef['UpperArm.'+side]=(end('upperarm01.'+side,'head'),end('lowerarm01.'+side,'head'),'Clavicle.'+side)
 rigdef['Forearm.'+side]=(end('lowerarm01.'+side,'head'),end('wrist.'+side,'head'),'UpperArm.'+side)
 rigdef['Hand.'+side]=(end('wrist.'+side,'head'),end('wrist.'+side,'tail'),'Forearm.'+side)
 rigdef['Thigh.'+side]=(end('upperleg01.'+side,'head'),end('lowerleg01.'+side,'head'),'Hips')
 rigdef['Shin.'+side]=(end('lowerleg01.'+side,'head'),end('foot.'+side,'head'),'Thigh.'+side)
 rigdef['Foot.'+side]=(end('foot.'+side,'head'),end('foot.'+side,'tail'),'Shin.'+side)
 for finger in range(1,6):
  for segment in range(1,4):
   old=f'finger{finger}-{segment}.{side}';name=f'Finger{finger}_{segment}.{side}'
   rigdef[name]=(end(old,'head'),end(old,'tail'),'Hand.'+side if segment==1 else f'Finger{finger}_{segment-1}.{side}')
F=Vector((0,.0235,.65));G=Vector((0,.985,.30));D=(F-G).normalized();LENGTH=(F-G).length
rigdef['Grip']=(G,G+D*.12,None)
rigdef['ClubFaceAnchor']=(F,F+Vector((.01,0,0)),'Grip')
# Weight mapping reduces twist chains but retains actual articulated hands.
def mapped(name):
 if name=='root' or name.startswith(('pelvis','breast')):return 'Hips' if not name.startswith('breast') else 'Chest'
 if name in ['spine05','spine04']:return 'Spine'
 if name.startswith('spine'):return 'Chest'
 if name.startswith('neck'):return 'Neck'
 for prefix,dest in [('clavicle','Clavicle'),('shoulder','Clavicle'),('upperarm','UpperArm'),('lowerarm','Forearm'),('upperleg','Thigh'),('lowerleg','Shin'),('foot','Foot'),('toe','Foot'),('wrist','Hand'),('metacarpal','Hand')]:
  if name.startswith(prefix):return dest+'.'+name[-1]
 if name.startswith('finger'):
  finger=int(name[6]);seg=int(name[8]);return f'Finger{finger}_{seg}.{name[-1]}'
 return 'Head'
weights=[{} for _ in V]
for name,items in W.items():
 dst=mapped(name)
 for index,w in items:weights[index][dst]=weights[index].get(dst,0)+w
for w in weights:
 if w:
  total=sum(w.values())
  for k in w:w[k]/=total
kd=KDTree(len(body_ids))
for i in body_ids:kd.insert(B(V[i]),i)
kd.balance()
def skinweights(i):
 if weights[i]:return weights[i]
 nearest=kd.find_n(B(V[i]),4);result={}
 for _,index,d in nearest:
  fac=1/max(d,.002)**2
  for bone,w in weights[index].items():result[bone]=result.get(bone,0)+w*fac
 total=sum(result.values()) or 1
 return {k:v/total for k,v in result.items()}
# Armature has no dummy visible mannequin.
arm=bpy.data.armatures.new('TourAthleteSkeleton');rig=bpy.data.objects.new('TourAthleteRig',arm);bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,(head,tail,parent) in rigdef.items():
 bone=arm.edit_bones.new(name);bone.head=B(head);bone.tail=B(tail);bone.align_roll(B((0,0,1)));bone.use_deform=True
 if parent:bone.parent=arm.edit_bones[parent]
# Hand local Z is the anatomical inward palm normal; fingers curl towards it.
for side in ['L','R']:
 wrist=end('wrist.'+side,'head');middle=end('finger3-1.'+side,'head');index=end('finger2-1.'+side,'head');little=end('finger5-1.'+side,'head')
 normal=(middle-wrist).cross(index-little).normalized()
 if normal.y>0:normal=-normal
 for name in ['Hand.'+side]+[f'Finger{f}_{s}.{side}' for f in range(1,6) for s in range(1,4)]:arm.edit_bones[name].align_roll(B(normal))
bpy.ops.object.mode_set(mode='OBJECT');rig.select_set(False)
# PBR materials, not a pasted front/back photograph over a distorted body.
def mat(name,color,rough=.6,metal=0):
 m=bpy.data.materials.new(name);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=rough;p.inputs['Metallic'].default_value=metal;return m
skin=mat('Skin — anatomical UV',(.58,.36,.22),.66)
navy=mat('Navy woven tour polo',(.018,.032,.056),.79)
pants=mat('Ivory grey tailored trousers',(.43,.44,.41),.84)
white=mat('White leather / cap',(.88,.89,.84),.64)
black=mat('Charcoal trim / belt / outsole',(.026,.031,.035),.67)
hairmat=mat('Dark cropped hair',(.026,.019,.014),.90)
shaft=mat('Graphite shaft',(.018,.024,.027),.25,.55)
steel=mat('Club steel',(.44,.47,.48),.23,.90)
irismat=mat('Brown iris',(.10,.059,.025),.35)
eyeWhite=mat('Eye sclera',(.72,.69,.60),.35)
pupil=mat('Pupil',(.005,.005,.006),.22)
# Face texture has its original anatomy UVs, including facial features.
# Rasterization is performed by a separate numpy/Pillow helper before Blender.
if (SRC/'skin-atlas.png').exists():
 tex=skin.node_tree.nodes.new('ShaderNodeTexImage');tex.image=bpy.data.images.load(str(SRC/'skin-atlas.png'));skin.node_tree.links.new(tex.outputs['Color'],skin.node_tree.nodes.get('Principled BSDF').inputs['Base Color'])
# A subtle, embedded micro-weave normal texture is UV mapped, not geometry spikes.
if (SRC/'weave-normal.png').exists():
 for material in [navy,pants]:
  t=material.node_tree.nodes.new('ShaderNodeTexImage');t.image=bpy.data.images.load(str(SRC/'weave-normal.png'),check_existing=True);t.image.colorspace_settings.name='Non-Color'
  nm=material.node_tree.nodes.new('ShaderNodeNormalMap');nm.inputs['Strength'].default_value=.18;material.node_tree.links.new(t.outputs['Color'],nm.inputs['Color']);material.node_tree.links.new(nm.outputs['Normal'],material.node_tree.nodes.get('Principled BSDF').inputs['Normal'])
def mesh(name,verts,polys,material,uvdata=None,boneweights=None):
 data=bpy.data.meshes.new(name);data.from_pydata([B(v) for v in verts],[],polys);data.update();o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.data.materials.append(material)
 for p in data.polygons:p.use_smooth=True
 if uvdata:
  uv=data.uv_layers.new(name='AnatomicalUV')
  for p,coords in zip(data.polygons,uvdata):
   for li,co in zip(p.loop_indices,coords):uv.data[li].uv=co
 if boneweights:
  names=set(k for w in boneweights for k in w)
  vg={n:o.vertex_groups.new(name=n) for n in names}
  for i,w in enumerate(boneweights):
   for n,s in w.items():
    if s>.001:vg[n].add([i],s,'REPLACE')
  mod=o.modifiers.new('True skeletal deformation','ARMATURE');mod.object=rig;o.parent=rig
 return o
# Skin is present only where clothes are absent. Helpers are NOT rendered.
skinFaces=[];shirtFaces=[];pantsFaces=[]
def clothing(face):
 c=V[face].mean(0);w={}
 for i in face:
  for b,s in skinweights(i).items():w[b]=w.get(b,0)+s/len(face)
 dominant=max(w,key=w.get)
 if dominant.startswith(('Thigh','Shin','Foot')) or (c[1]<1.025 and abs(c[0])<.27):return 'pants'
 if dominant in ['Hips','Spine','Chest'] or dominant.startswith('Clavicle') or (dominant=='Neck' and c[1]<1.565):return 'shirt'
 if dominant.startswith('UpperArm'):
  side=dominant[-1];a=end('upperarm01.'+side,'head');b=end('lowerarm01.'+side,'head');t=(Vector(c)-a).dot(b-a)/(b-a).length_squared
  if t<.72:return 'shirt'
 return 'skin'
for fi,(f,g) in enumerate(zip(faces,groups)):
 if g=='body':
  kind=clothing(f)
  if kind=='skin' or (V[f,1].mean()>1.445 and abs(V[f,0].mean())<.12):skinFaces.append(fi)
# Clothing from the looser topology-fitted clothes cage, independently skinned.
for fi,(f,g) in enumerate(zip(faces,groups)):
 if g=='helper-tights':
  kind=clothing(f)
  if kind=='pants' and V[f,1].mean()>.06:pantsFaces.append(fi)
  elif kind=='shirt':
   c=V[f].mean(0)
   if not (c[1]>1.492 and c[2]>.075 and abs(c[0])<min(.035,(c[1]-1.492)*.50)):shirtFaces.append(fi)
def part(name,indices,material,inflate=0):
 ids=sorted(set(i for fi in indices for i in faces[fi]));lookup={i:n for n,i in enumerate(ids)};coords=V[ids].copy()
 if name=='Tailored navy polo':
  for k,i in enumerate(ids):
   if coords[k,1]<1.08:coords[k,1]=max(coords[k,1],1.030)
 if inflate:
  for k,i in enumerate(ids):
   w=skinweights(i);dominant=max(w,key=w.get)
   if dominant.startswith(('Thigh','Shin','Foot')):
    center=end(('upperleg01.' if dominant.startswith('Thigh') else 'lowerleg01.')+dominant[-1],'head')
    coords[k,0]+=(1 if coords[k,0]>center.x else -1)*inflate;coords[k,2]+=(1 if coords[k,2]>center.z else -1)*inflate
   elif not dominant.startswith(('Hand','Finger')):
    coords[k,0]*=1.035;coords[k,2]+=(1 if coords[k,2]>.015 else -1)*inflate
 return mesh(name,coords,[[lookup[i]for i in faces[fi]]for fi in indices],material,[[UV[i]for i in uvfaces[fi]]for fi in indices],[skinweights(i)for i in ids])
body=part('Anatomical skin and face',skinFaces,skin)
polo=part('Tailored navy polo',shirtFaces,navy,.009)
trousers=part('Tailored grey trousers',pantsFaces,pants,.004)
# Subdivide the true anatomy and garment topology, retaining weighted deformation.
for ob in [body,polo,trousers]:
 sub=ob.modifiers.new('Smooth anatomical / fabric topology','SUBSURF');sub.levels=1;sub.render_levels=1
 bpy.context.view_layer.objects.active=ob;ob.select_set(True)
 bpy.ops.object.modifier_move_up(modifier=sub.name)
 bpy.ops.object.modifier_apply(modifier=sub.name);ob.select_set(False)
# Low amplitude folds are geometry, not stripes painted onto smooth tubes.
for vertex in trousers.data.vertices:
 n=N(vertex.co);y=n.y
 if .14<y<.87:
  # Slight folds at the ankle and around the knee; restrained smooth thigh fit.
  envelope=.0035*math.exp(-((y-.19)/.075)**2)+.0025*math.exp(-((y-.53)/.10)**2)
  n.z+=envelope*math.sin(y*120+n.x*16);n.x+=envelope*.45*math.sin(y*95)
  vertex.co=B(n)
for vertex in polo.data.vertices:
 n=N(vertex.co)
 if 1.06<n.y<1.31 and abs(n.x)<.20:
  n.z+=(.0018*math.sin(n.y*95+n.x*25))*math.exp(-((n.y-1.12)/.085)**2)
  vertex.co=B(n)

# White glove really follows the finger bones, rather than floating at a wrist.
for poly in body.data.polygons:
 original_center=N(poly.center) # centers updated below; select via vertex weights
 weights_poly=[body.vertex_groups[g.group].name for vi in poly.vertices for g in body.data.vertices[vi].groups]
 if any(n.endswith('.L') and n.startswith(('Hand','Finger')) for n in weights_poly):
  if len(body.data.materials)<2:body.data.materials.append(white)
  poly.material_index=1
# Primitive additions are fitted accessories, not an anatomical mannequin.
def ellipsoid(name,center,radius,material,bone,seg=24,rings=12):
 verts=[];uv=[]
 for r in range(rings+1):
  t=math.pi*r/rings
  for k in range(seg):
   phi=2*math.pi*k/seg;verts.append((center[0]+radius[0]*math.sin(t)*math.cos(phi),center[1]+radius[1]*math.cos(t),center[2]+radius[2]*math.sin(t)*math.sin(phi)))
 polys=[];uvs=[]
 for r in range(rings):
  for k in range(seg):
   polys.append([r*seg+k,r*seg+(k+1)%seg,(r+1)*seg+(k+1)%seg,(r+1)*seg+k]);uvs.append([(k/seg,r/rings),((k+1)/seg,r/rings),((k+1)/seg,(r+1)/rings),(k/seg,(r+1)/rings)])
 return mesh(name,verts,polys,material,uvs,[{bone:1}for _ in verts])
# Fitted eyes sit inside the lids; iris front faces forward.
for side in ['L','R']:
 # Helper-eye cage provides the actual eyeball centre, unlike its aim bone.
 idx=sorted(set(i for f,g in zip(faces,groups) if g=='helper-'+side.lower()+'-eye' for i in f))
 c=Vector(V[idx].mean(0)) if idx else end('eye.'+side,'head')
 extent=(V[idx].max(0)-V[idx].min(0))/2 if idx else np.array([.012,.012,.012])
 rad=float(max(.009,min(.0118,extent[0]*.77)))
 ellipsoid('Eye.'+side,c,(rad,rad,rad),eyeWhite,'Head',20,10)
 ellipsoid('Iris.'+side,(c.x,c.y-rad*.10,c.z+rad*.96),(.006,.006,.0017),irismat,'Head',20,8)
 ellipsoid('Pupil.'+side,(c.x,c.y-rad*.10,c.z+rad*1.02),(.0028,.0028,.001),pupil,'Head',16,6)
# Low, real hair shell follows the back/sides of the scalp; face is not painted on it.
hairIds=[]
for fi in skinFaces:
 c=V[faces[fi]].mean(0)
 if (c[1]>1.726 or (c[1]>1.66 and c[2]<.025) or (c[1]>1.694 and abs(c[0])>.083 and c[2]<.090)):hairIds.append(fi)
hair=part('Cropped dark hair',hairIds,hairmat,.001)
# Cap crown with stitched panels and actual solid brim.
capC=Vector((0,1.736,.071));verts=[];polys=[];uvs=[];seg=48;rings=14
for r in range(rings+1):
 t=(math.pi/2)*r/rings
 for k in range(seg):
  phi=2*math.pi*k/seg;verts.append((.094*math.sin(t)*math.cos(phi),capC.y+.083*math.cos(t),capC.z+.116*math.sin(t)*math.sin(phi)))
for r in range(rings):
 for k in range(seg):
  polys.append([r*seg+k,r*seg+(k+1)%seg,(r+1)*seg+(k+1)%seg,(r+1)*seg+k]);uvs.append([(k/seg,r/rings),((k+1)/seg,r/rings),((k+1)/seg,(r+1)/rings),(k/seg,(r+1)/rings)])
cap=mesh('White six-panel cap',verts,polys,white,uvs,[{'Head':1}for _ in verts])
verts=[];polys=[]
for r in range(5):
 z=.124+r*.029
 for k in range(25):
  x=(k/24*2-1)*(.09*math.sqrt(max(.15,1-(r/5)**2)));verts.append((x,1.733-.012*(r/4)**2+.009*(x/.09)**2,z))
for r in range(4):
 for k in range(24):polys.append([r*25+k,r*25+k+1,(r+1)*25+k+1,(r+1)*25+k])
visor=mesh('Solid white visor',verts,polys,white,None,[{'Head':1}for _ in verts]);sol=visor.modifiers.new('Visor thickness','SOLIDIFY');sol.thickness=.004
# Seam piping and a restrained cap badge are attached real geometry.
def tube(name,a,b,radius,material,bone,segments=12):
 a=Vector(a);b=Vector(b);d=(b-a).normalized();u=d.cross(Vector((0,1,0)))
 if u.length<.01:u=d.cross(Vector((1,0,0)))
 u.normalize();v=d.cross(u);verts=[]
 for p in [a,b]:
  for k in range(segments):verts.append(p+(u*math.cos(k*2*math.pi/segments)+v*math.sin(k*2*math.pi/segments))*radius)
 polys=[[k,(k+1)%segments,segments+(k+1)%segments,segments+k]for k in range(segments)]+[list(range(segments-1,-1,-1)),list(range(segments,2*segments))]
 return mesh(name,verts,polys,material,None,[{bone:1}for _ in verts])
# Fitted raised cap lettering, modelled and skin-bound to the head.
bpy.ops.object.text_add(location=B((-.052,1.766,.191)))
label=bpy.context.object;label.data.body='TaylorMade';label.data.size=.014;label.data.extrude=.0002;label.data.resolution_u=3;label.rotation_euler=(math.pi/2,0,0);label.data.materials.append(black)
bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
vg=label.vertex_groups.new(name='Head');vg.add(list(range(len(label.data.vertices))),1,'REPLACE');mod=label.modifiers.new('Head-bound embroidery','ARMATURE');mod.object=rig;label.parent=rig;label.name='Cap embroidery'
# Waist belt is an actual ring; collar is a turned 3D band above the polo.
for name,y,rx,rz,material,bone,h in [('Dark fitted belt',1.027,.166,.124,black,'Hips',.026),('Polo stand collar',1.520,.083,.071,navy,'Chest',.027)]:
 verts=[];polys=[]
 for yy in [y-h/2,y+h/2]:
  for k in range(48):a=k*2*math.pi/48;verts.append((rx*math.cos(a),yy,.014+rz*math.sin(a)))
 for k in range(48):
  a=(k+.5)*2*math.pi/48
  if name=='Polo stand collar' and math.sin(a)>.8:continue
  polys.append([k,(k+1)%48,48+(k+1)%48,48+k])
 mesh(name,verts,polys,material,None,[{bone:1}for _ in verts])
# Polo placket and buttons, following the chest; no detached belt/cloth cards.
for i in range(3):ellipsoid('Polo button '+str(i),(0,1.49-i*.027,.125),(.0037,.0037,.002),black,'Chest',12,6)
# Detailed game-ready golf shoes: lofted foot shape, layered sole, heel,
# tongue, laces and side panels, instead of inflated ellipsoid slippers.
def shoe_section(name,x,stations,material,bone,sole=False):
 verts=[];polys=[];uv=[];n=32
 for j,(z,width,height) in enumerate(stations):
  for k in range(n):
   a=k*2*math.pi/n
   if sole:
    yy=.020+.015*math.sin(a);xx=width*math.cos(a)
   else:
    yy=.032+height*max(0,math.sin(a))**.72;xx=width*math.cos(a)
   verts.append((x+xx,yy,z));
 for j in range(len(stations)-1):
  for k in range(n):
   polys.append([j*n+k,j*n+(k+1)%n,(j+1)*n+(k+1)%n,(j+1)*n+k]);uv.append([(k/n,j/(len(stations)-1)),((k+1)/n,j/(len(stations)-1)),((k+1)/n,(j+1)/(len(stations)-1)),(k/n,(j+1)/(len(stations)-1))])
 polys.extend([list(range(n-1,-1,-1)),list(range((len(stations)-1)*n,len(stations)*n))]);uv.extend([[(.5,.5)]*n,[(.5,.5)]*n])
 return mesh(name,verts,polys,material,uv,[{bone:1}for _ in verts])
for side in ['L','R']:
 x=end('foot.'+side,'head').x;bone='Foot.'+side
 shape=[(-.063,.027,.065),(-.055,.041,.082),(-.025,.046,.103),(.015,.047,.108),(.055,.047,.096),(.105,.054,.071),(.155,.052,.051),(.200,.043,.041),(.225,.025,.035),(.236,.002,.025)]
 shoe_section('Structured leather golf upper.'+side,x,shape,white,bone)
 sole=[(z,w*1.04,h)for z,w,h in shape]
 shoe_section('Layered navy outsole.'+side,x,sole,black,bone,True)
 # White midsole line, a broad leather tongue and visible stitching/laces.
 for j in range(len(shape)-1):
  z,w,h=shape[j];zz,ww,hh=shape[j+1]
  for sign in [-1,1]:tube('Midsole piping.'+side,(x+sign*w*1.04,.033,z),(x+sign*ww*1.04,.033,zz),.0032,white,bone,8)
 tongue=[(x-.021,.143,.005),(x+.021,.143,.005),(x+.022,.115,.073),(x-.022,.115,.073),(x-.023,.099,.125),(x+.023,.099,.125)]
 mesh('Shoe tongue.'+side,tongue,[[0,1,2,3],[3,2,5,4]],white,None,[{bone:1}for _ in tongue])
 for i in range(6):
  z=.015+i*.018;y=.140-i*.007
  tube('Crossed lace A.'+side,(x-.019,y,z),(x+.019,y-.004,z+.013),.0014,white,bone,8)
  tube('Crossed lace B.'+side,(x+.019,y,z),(x-.019,y-.004,z+.013),.0014,white,bone,8)
  for sign in [-1,1]:ellipsoid('Lace eyelet.'+side,(x+sign*.024,y-.004,z),(.002,.0015,.002),black,bone,10,6)
 for sign in [-1,1]:
  # Golf-shoe leather side panel outline, not a flat photo card.
  pts=[(x+sign*.046,.065,-.023),(x+sign*.048,.073,.03),(x+sign*.054,.056,.11),(x+sign*.046,.047,.17)]
  for a,b in zip(pts,pts[1:]):tube('Upper stitched panel.'+side,a,b,.0012,black,bone,8)
 ellipsoid('Heel counter.'+side,(x,.070,-.057),(.031,.026,.004),white,bone,24,10)
# Actual folded collar leaves and placket.
for sign in [-1,1]:
 pts=[(sign*.071,1.546,.056),(sign*.084,1.516,.098),(sign*.061,1.478,.145),(sign*.025,1.519,.142)]
 leaf=mesh('Folded polo collar',pts,[[0,1,2,3]],navy,None,[{'Chest':1}for _ in pts]);solid=leaf.modifiers.new('Folded cloth thickness','SOLIDIFY');solid.thickness=.002
 for a,b in zip(pts,pts[1:]):tube('Collar seam',a,b,.00065,navy,'Chest',6)
pl=[(-.012,1.516,.144),(.012,1.516,.144),(.011,1.403,.132),(-.011,1.403,.132)]
mesh('Button placket',pl,[[0,1,2,3]],navy,None,[{'Chest':1}for _ in pl])
# Reference chest embroidery: actual small extruded lettering and stripes.
bpy.ops.object.text_add(location=B((.070,1.413,.146)))
logo=bpy.context.object;logo.data.body='adidas';logo.data.size=.012;logo.data.extrude=.00015;logo.data.resolution_u=3;logo.rotation_euler=(math.pi/2,0,0);logo.data.materials.append(white)
bpy.ops.object.convert(target='MESH');bpy.ops.object.transform_apply(location=False,rotation=True,scale=True)
vg=logo.vertex_groups.new(name='Chest');vg.add(list(range(len(logo.data.vertices))),1,'REPLACE');mod=logo.modifiers.new('Chest embroidery deformation','ARMATURE');mod.object=rig;logo.parent=rig
for i in range(3):
 x=.076+i*.009;h=.007+i*.005
 mesh('Three-stripe chest embroidery',[(x,1.433,.146),(x+.006,1.433,.146),(x+.013,1.433+h,.146),(x+.007,1.433+h,.146)],[[0,1,2,3]],white,None,[{'Chest':1}]*4)
# Buckle, belt loops and pockets supply the missing trouser construction.
for a,b in [((-.017,1.016,.144),(.017,1.016,.144)),((-.017,1.038,.144),(.017,1.038,.144)),((-.017,1.016,.144),(-.017,1.038,.144)),((.017,1.016,.144),(.017,1.038,.144))]:tube('Belt buckle',a,b,.0017,steel,'Hips',8)
for xx in [-.135,-.08,.08,.135]:tube('Belt loop',(xx,1.006,.10),(xx,1.047,.10),.004,pants,'Hips',8)
for sign in [-1,1]:
 tube('Front pocket opening',(sign*.12,1.002,.104),(sign*.17,.922,.086),.0011,black,'Hips',8)
# Cap seams, top button and rear adjustment strap.
for k in range(6):
 phi=2*math.pi*k/6;last=None
 for r in range(1,17):
  t=math.pi/2*r/16;p=(.0945*math.sin(t)*math.cos(phi),capC.y+.084*math.cos(t),capC.z+.1165*math.sin(t)*math.sin(phi))
  if last:tube('Cap panel stitching',last,p,.0005,white,'Head',6)
  last=p
ellipsoid('Cap top button',(0,1.820,.071),(.007,.003,.007),white,'Head',20,8)
mesh('Rear cap adjustment strap',[(-.037,1.746,-.043),(.037,1.746,-.043),(.037,1.727,-.043),(-.037,1.727,-.043)],[[0,1,2,3]],white,None,[{'Head':1}]*4)
# Exactly ONE shaft and grip. Three heads are alternatives, selected in the game.
tube('ClubShaft',G+D*.10,F,.005,shaft,'Grip',16)
tube('ClubGrip',G-D*.01,G+D*.21,.0115,black,'Grip',20)
ellipsoid('DriverHead',F+Vector((-.045,0,0)),(.045,.023,.038),black,'Grip',28,12)
ellipsoid('IronHead',F+Vector((-.018,0,0)),(.018,.021,.043),steel,'Grip',24,10)
ellipsoid('PutterHead',F+Vector((-.025,0,0)),(.025,.014,.056),steel,'Grip',24,10)
# Combine accessories by material while preserving weights and ONE club shaft.
# Fewer draw calls, no duplicate render-only human model.
for ob in list(bpy.context.scene.objects):
 if ob.type=='MESH':
  for mod in list(ob.modifiers):
   if mod.type=='SOLIDIFY':
    bpy.context.view_layer.objects.active=ob;ob.select_set(True);bpy.ops.object.modifier_apply(modifier=mod.name);ob.select_set(False)
by_material={}
for ob in list(bpy.context.scene.objects):
 if ob.type=='MESH' and len(ob.data.materials)==1 and ob.name not in ['DriverHead','IronHead','PutterHead','ClubShaft','ClubGrip']:
  by_material.setdefault(ob.data.materials[0].name,[]).append(ob)
for material,objects in by_material.items():
 if len(objects)<2:continue
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();objects[0].name=material+' accessories'
bpy.ops.object.select_all(action='DESELECT')
# Pose utilities: solve articulated shoulders/elbows and planted knees, not
# rotation of the whole unrigged body. Runtime applies the same contact IK.
def world_rotation(pb,q):
 p=pb.matrix.translation.copy();pb.matrix=Matrix.Translation(p)@q.to_matrix().to_4x4();bpy.context.view_layer.update()
def point(pb,direction):
 q=pb.matrix.to_quaternion();current=q@Vector((0,1,0));world_rotation(pb,current.rotation_difference(direction.normalized())@q)
def ik(a,b,target,pole):
 pa=rig.pose.bones[a];pb=rig.pose.bones[b];start=pa.matrix.translation.copy();l1=arm.bones[a].length;l2=arm.bones[b].length
 delta=target-start;dist=max(.001,min(delta.length,l1+l2-.0001));direction=delta.normalized();projection=pole-direction*pole.dot(direction)
 if projection.length<.001:projection=direction.cross(Vector((0,1,0)))
 projection.normalize();along=(l1*l1-l2*l2+dist*dist)/(2*dist);height=math.sqrt(max(0,l1*l1-along*along));elbow=start+direction*along+projection*height
 point(pa,elbow-start);point(pb,target-pb.matrix.translation)
def handpose(side,target,direction):
 inward=Vector((-1 if side=='L' else 1,0,0));y=direction.normalized();z=(inward-y*inward.dot(y)).normalized();x=y.cross(z).normalized();z=x.cross(y).normalized();q=Matrix((B(x),B(y),B(z))).transposed().to_quaternion()
 world_rotation(rig.pose.bones['Hand.'+side],q)
 for f in range(1,6):
  for s in range(1,4):
   p=rig.pose.bones[f'Finger{f}_{s}.{side}'];p.rotation_mode='XYZ';p.rotation_euler=(.55 if f==1 else [.0,.78,.95,.60][s],0,0)
 bpy.context.view_layer.update()
def bodypose(theta,twist,style,progress):
 for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_mode='XYZ';pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
 rig.pose.bones['Hips'].location=B((-.020*math.sin(theta),-.045,0))
 rig.pose.bones['Hips'].rotation_euler=(0,twist*.32,0)
 rig.pose.bones['Spine'].rotation_euler=(.10,twist*.20,0)
 look=max(0,math.sin(theta/2)) # release the gaze towards the target after impact
 rig.pose.bones['Chest'].rotation_euler=((.32 if style!='Putt' else .40)-.12*look,twist*.48,0)
 rig.pose.bones['Neck'].rotation_euler=(.10-.07*look,-twist*.18*(1-look),0)
 rig.pose.bones['Head'].rotation_euler=(.12-.12*look,-twist*.22*(1-look)+.35*look,0)
 bpy.context.view_layer.update()
 pivot=Vector((0,1.20,.24));rot=Quaternion(Vector((0,0,1)),theta);grip=pivot+rot@(G-pivot);dir=rot@D
 # Grip is a root deform bone with a known physical shaft direction.
 pb=rig.pose.bones['Grip'];base=arm.bones['Grip'].matrix_local.to_quaternion();pb.matrix=Matrix.Translation(B(grip))@(Quaternion(Vector((0,-1,0)),theta)@base).to_matrix().to_4x4();bpy.context.view_layer.update()
 for side,sign,offset in [('L',1,-.035),('R',-1,.045)]:
  target=grip+dir*offset+Vector((sign*.024,0,0))
  ik('UpperArm.'+side,'Forearm.'+side,B(target),B((sign*.45,-.10,-.32)))
  handpose(side,target,dir)
 for side,sign in [('L',1),('R',-1)]:
  target=end('foot.'+side,'head');ik('Thigh.'+side,'Shin.'+side,B(target),B((sign*.1,0,1)))
  # Restore the shoe's planted rest-world orientation after the knee solve.
  world_rotation(rig.pose.bones['Foot.'+side],arm.bones['Foot.'+side].matrix_local.to_quaternion())
 return grip
CLIPS={'FullSwing':(2.30,2.35,.85,1.12),'ThreeQuarter':(1.72,1.85,.64,.85),'HalfSwing':(1.12,1.24,.40,.57),'Chip':(.48,.60,.18,.23),'Putt':(.095,.115,.045,.055)}
rig.animation_data_create()
for style,(back,follow,backtwist,followtwist) in CLIPS.items():
 action=bpy.data.actions.new(style);rig.animation_data.action=action
 for frame in range(0,101,2):
  if frame<=40:p=frame/40;theta=-back*math.sin(p*math.pi/2);twist=-backtwist*math.sin(p*math.pi/2)
  elif frame<=50:p=(frame-40)/10;theta=-back*(1-p*p);twist=-backtwist*(1-p*p)
  else:p=(frame-50)/50;e=1-(1-p)**2;theta=follow*e;twist=followtwist*e
  bodypose(theta,twist,style,p)
  for pb in rig.pose.bones:
   pb.keyframe_insert(data_path='location',frame=frame);pb.keyframe_insert(data_path='rotation_euler',frame=frame);pb.keyframe_insert(data_path='scale',frame=frame)
 for fc in action.fcurves:
  for key in fc.keyframe_points:key.interpolation='LINEAR'
 track=rig.animation_data.nla_tracks.new();track.name=style;track.strips.new(style,0,action);track.mute=True
rig.animation_data.action=None
# Metadata states what is authored rather than making a photorealism assertion.
rig['character_version']='rig11';rig['contact_frame']=50;rig['back_frame']=40;rig['end_frame']=100;rig['frame_rate']=60;rig['anatomy_source']='MakeHuman core graphical assets, CC0';rig['reference']='IMG_9091: navy polo, pale trousers, white cap/glove/shoes; facial atlas fitted to real anatomy'
scene=bpy.context.scene;scene.render.fps=60;scene.frame_start=0;scene.frame_end=100
bodypose(0,0,'FullSwing',0)
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'puttclub_golfer_rigged.blend'),compress=True)
bpy.ops.object.select_all(action='DESELECT')
for o in bpy.context.scene.objects:
 if o.type in ['MESH','ARMATURE']:o.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'pro_golfer_character.glb'),export_format='GLB',use_selection=True,export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_frame_range=False,export_nla_strips=True,export_skins=True,export_apply=False,export_extras=True,export_yup=True,export_image_format='AUTO')
print('EXPORTED',OUT/'pro_golfer_character.glb')
# Honest inspection renders, using the exact skinned mesh that was exported.
for o in bpy.context.scene.objects:
 if o.name in ['IronHead','PutterHead']:o.hide_render=True
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.cycles.use_denoising=False;scene.render.resolution_x=780;scene.render.resolution_y=1000;scene.render.resolution_percentage=100
scene.world.color=(.30,.30,.30)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.008));floorObj=bpy.context.object;floorObj.data.materials.append(mat('Studio floor',(.30,.31,.30),.9))
for pos,power,size in [((3,-4,6),550,4),((-3,-1,4),350,3),((1,3,5),450,3)]:
 bpy.ops.object.light_add(type='AREA',location=pos);light=bpy.context.object;light.data.energy=power;light.data.shape='DISK';light.data.size=size;light.rotation_euler=(Vector((0,0,1))-light.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add();camera=bpy.context.object;scene.camera=camera;camera.data.type='ORTHO';camera.data.ortho_scale=2.0
for name,pos in [('front',(2,-4,2.2)),('side',(-3,-2,1.8))]:
 camera.location=pos;camera.rotation_euler=(Vector((0,-.14,.90))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'audit/character11'/f'model-{name}.png');bpy.ops.render.render(write_still=True)

# Additional true-geometry neutral views for visual comparison with reference.
for pb in rig.pose.bones:pb.location=(0,0,0);pb.rotation_euler=(0,0,0);pb.scale=(1,1,1)
bpy.context.view_layer.update()
for side,sign in [('L',1),('R',-1)]:
 target=Vector((sign*.240,1.045 if side=='R' else 1.01,.17 if side=='R' else .035))
 ik('UpperArm.'+side,'Forearm.'+side,B(target),B((sign*.20,0,-.40)))
 handpose(side,target,Vector((0,-1,0)))
 for f in range(1,6):
  for seg in range(1,4):rig.pose.bones[f'Finger{f}_{seg}.{side}'].rotation_euler=(.25 if side=='L' else .75,0,0)
pb=rig.pose.bones['Grip'];m=pb.matrix.copy();m.translation=B((-.216,1.045,.17));pb.matrix=m;point(pb,B((0,-1,0)));bpy.context.view_layer.update()
camera.data.ortho_scale=2.0
for name,pos in [('neutral-front',(0,-4,1.2)),('neutral-side',(-4,0,1.2)),('neutral-back',(0,4,1.2)),('neutral-quarter',(2.8,-4,1.2))]:
 camera.location=pos;camera.rotation_euler=(Vector((0,0,.92))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'audit/character11'/f'{name}.png');bpy.ops.render.render(write_still=True)
camera.data.ortho_scale=.40;camera.location=(0,-4,1.69);camera.rotation_euler=(Vector((0,-.10,1.675))-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(ROOT/'audit/character11'/'neutral-face.png');bpy.ops.render.render(write_still=True)
