/* Putt Club elbows29. Existing skinned human, metre-calibrated rigid clubs.
 * Original key-pose animation, NOT mocap or a biomechanical certification.
 * GolfMotion is skeleton-independent; GolfAthlete is the replaceable rig adapter.
 */
(() => {
  'use strict';
  const T=THREE, V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z), Y=V(0,1,0), Z=V(0,0,1);
  const clamp=T.MathUtils.clamp, rad=T.MathUtils.degToRad;
  const CLUBS=Object.freeze({
    '1W':{length:1.1557,lie:58.5,loft:12,head:'DriverHead',size:[1.28,1.10,1.52]},
    '3W':{length:1.0922,lie:59,loft:14.5,head:'DriverHead',size:[1.10,.88,1.23]},
    '5W':{length:1.0668,lie:59.5,loft:17.5,head:'DriverHead',size:[1.03,.84,1.15]},
    '4I':{length:.9779,lie:61.5,loft:21,head:'IronHead',size:[.46,.98,1.04]},
    '5I':{length:.9652,lie:62,loft:24.5,head:'IronHead',size:[.44,1,1.02]},
    '6I':{length:.9525,lie:62.5,loft:28,head:'IronHead',size:[.43,1,1.01]},
    '7I':{length:.9398,lie:63,loft:31.5,head:'IronHead',size:[.42,1,1]},
    '8I':{length:.9271,lie:63.5,loft:35.5,head:'IronHead',size:[.44,1.02,.99]},
    '9I':{length:.9144,lie:64,loft:39.5,head:'IronHead',size:[.46,1.03,.98]},
    'PW':{length:.90805,lie:64,loft:44,head:'IronHead',size:[.48,1.04,.98]},
    'AW':{length:.9017,lie:64,loft:48.5,head:'IronHead',size:[.50,1.05,.98]},
    'SW':{length:.89535,lie:64,loft:54,head:'IronHead',size:[.52,1.06,.98]},
    'PT':{length:.889,lie:70,loft:2.5,head:'PutterHead',size:[.90,.55,1.04]}
  });
  const styleNames={full:'FullSwing','three-quarter':'ThreeQuarter',half:'HalfSwing',chip:'Chip',punch:'Punch',putt:'Putt'};
  function smooth(a,b,t){const s=clamp((t-a)/(b-a),0,1);return s*s*(3-2*s);}
  function hermite(keys,t,field) {
    let i=0;while(i<keys.length-2&&t>keys[i+1].t)i++;
    const a=keys[i],b=keys[i+1],prev=keys[Math.max(0,i-1)],next=keys[Math.min(keys.length-1,i+2)],dt=b.t-a.t,u=clamp((t-a.t)/dt,0,1),u2=u*u,u3=u2*u;
    const tangent=(left,middle,right)=>{const h0=middle.t-left.t,h1=right.t-middle.t,s0=(middle[field]-left[field])/h0,s1=(right[field]-middle[field])/h1;if(s0*s1<=0)return 0;const w0=2*h1+h0,w1=h1+2*h0;return (w0+w1)/(w0/s0+w1/s1)};const va=a[field],vb=b[field],ma=i===0?0:tangent(prev,a,b),mb=i+1===keys.length-1?0:tangent(a,b,next);
    return (2*u3-3*u2+1)*va+(u3-2*u2+u)*dt*ma+(-2*u3+3*u2)*vb+(u3-u2)*dt*mb;
  }
  function orientation(direction,roll=0) {
    const y=direction.clone().normalize(),z=Z.clone().addScaledVector(y,-Z.dot(y)).normalize(),x=y.clone().cross(z).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).multiply(new T.Quaternion().setFromAxisAngle(Y,roll));
  }
  class GolfMotion {
    // Geometry first: each grounded, unscaled club defines its grip. The body
    // adapter solves a separate stance for every native club from that grip.
    static club(club={}) {const s=CLUBS[club.id]||CLUBS[club.isPutter?'PT':'7I'];return {...s,size:s.size.slice(),addressAngle:s.lie,loft:Number.isFinite(club.loft)?club.loft:s.loft};}
    static geometry(club={}) {const s=GolfMotion.club(club),wood=s.head==='DriverHead',putt=s.head==='PutterHead',height=wood?(club.id==='1W'?.058:club.id==='3W'?.044:.041):putt?.026:.052*s.size[1];return {headFloor:height/2,shaftLength:s.length-height/2,heelOffset:wood?.041:putt?.032:.033};}
    static address(club={},mode='full') {
      const s=GolfMotion.club(club),g=GolfMotion.geometry(club),putt=!!club.isPutter||mode==='putt',fit=GolfMotion.setups?.[club.id];
      const distance=fit?.distance??((g.shaftLength-.055)*Math.cos(rad(s.addressAngle))+g.heelOffset+.28);
      return {distance,lead:putt?0:club.id==='1W'?.10:club.cat==='wood'?.055:club.cat==='wedge'?-.018:0,width:putt?.29:mode==='chip'?.29:club.cat==='wood'?.46:.39};
    }
    static time(phase,p){p=clamp(p||0,0,1);return phase==='backswing'?.4*p:phase==='downswing'?.4+.1*p:phase==='followthrough'?.5+.5*p:phase==='fade'?1:0;}
    static keys(mode,h,d,impactH,impactD) {
      const k=(t,pos,dir,hip,chest,shift=0,heel=0,roll=0)=>({t,hx:pos[0],hy:pos[1],hz:pos[2],dx:dir[0],dy:dir[1],dz:dir[2],hip,chest,shift,heel,roll});
      const a=h.toArray(),di=d.toArray(),ih=impactH.toArray(),id=impactD.toArray();
      if(mode==='putt')return [k(0,a,di,0,0),k(.4,[a[0]-.075,a[1]+.006,a[2]],[-.10,di[1],di[2]],0,0),k(.5,ih,id,0,0),k(1,[a[0]+.09,a[1]+.009,a[2]],[.12,di[1],di[2]],0,0)];
      if(mode==='chip')return [k(0,a,di,.04,.04,.015),k(.4,[a[0]-.15,a[1]+.07,a[2]-.015],[-.38,-.82,.42],-.12,-.22,0),k(.5,ih,id,.16,.12,.035),k(.72,[a[0]+.16,a[1]+.075,a[2]-.015],[.38,-.83,.40],.24,.30,.045),k(1,[a[0]+.24,a[1]+.12,a[2]-.025],[.52,-.73,.43],.28,.40,.05)];
      if(mode==='half'||mode==='punch')return [k(0,a,di,0,0),k(.22,[-.24,a[1]+.10,a[2]-.03],[-.88,-.30,.36],-.18,-.40,-.012),k(.4,mode==='punch'?[-.37,1.13,.15]:[-.36,1.07,.17],mode==='punch'?[-.30,.94,.18]:[-.58,.79,.20],-.32,-.78,-.025),k(.45,[-.28,1.01,.19],[-.86,.38,.34],-.05,-.55,0),k(.5,ih,id,.34,.15,.04),k(.68,[.29,1.03,.18],[.81,.44,.39],.54,.65,.055,.12,-.15),k(1,mode==='punch'?[.40,1.08,.16]:[.37,1.18,.10],mode==='punch'?[.78,.56,.27]:[.10,.98,-.12],.68,.88,.065,.24,-.30)];
      const three=mode==='three-quarter';
      return [k(0,a,di,0,0),k(.07,[a[0]-.10,a[1]+.015,a[2]-.012],[-.35,di[1]*.95,di[2]*.95],-.06,-.20,-.006),k(.13,[-.20,Math.max(.94,a[1]+.13),a[2]-.035],[-.94,-.09,.32],-.10,-.30,-.012),k(.28,[-.35,1.22,-.06],[-.30,.92,.25],-.38,-.96,-.028),k(.365,three?[-.35,1.48,-.15]:[-.38,1.64,-.22],three?[.28,.94,-.18]:[.91,.28,-.30],-.60,three?-1.16:-1.40,-.032),k(.4,three?[-.35,1.50,-.16]:[-.37,1.66,-.23],three?[.35,.92,-.18]:[.94,.16,-.30],-.55,three?-1.20:-1.45,-.025),k(.445,[-.34,1.24,-.10],[.12,.97,-.20],-.12,three?-.95:-1.10,.006),k(.477,[-.24,.98,.20],[-.91,.14,.39],.25,-.48,.035),k(.5,ih,id,.55,.20,.055,.025),k(.60,[.30,1.03,.20],[.93,.10,.35],.82,.72,.07,.30,-.18),k(.73,[.42,1.29,.055],[.30,.94,-.16],1,1.21,.08,.64,-.55),k(.87,three?[.28,1.38,-.025]:[.23,1.47,-.04],three?[-.44,.83,-.34]:[-.80,.32,-.50],1.10,three?1.40:1.52,.085,.90,-.90),k(1,three?[.25,1.40,-.035]:[.20,1.48,-.065],three?[-.55,.72,-.42]:[-.90,-.12,-.42],1.12,three?1.43:1.56,.085,1,-1.05)];
    }
    static sample(keys,t) {
      const o={};for(const f of ['hx','hy','hz','dx','dy','dz','hip','chest','shift','heel','roll'])o[f]=hermite(keys,t,f);
      if(keys.length>7){const channels={hip:[[0,0],[.13,-.10],[.28,-.38],[.355,-.62],[.4,-.48],[.445,.12],[.48,.53],[.5,.65],[.60,.90],[.73,1.07],[1,1.12]],chest:[[0,0],[.13,-.30],[.28,-.96],[.4,-1.43],[.43,-1.35],[.47,-.70],[.5,.20],[.60,.76],[.73,1.23],[1,1.56]]};for(const [field,values]of Object.entries(channels))o[field]=hermite(values.map(([t,v])=>({t,[field]:v})),t,field);}
      o.hand=V(o.hx,o.hy,o.hz);o.direction=V(o.dx,o.dy,o.dz).normalize();
      // The face turns with the forearms, rather than holding a world-Z frame
      // throughout the backswing. Address and impact remain exactly calibrated.
      const rollKeys=[[0,0],[.07,35],[.13,115],[.28,105],[.4,85],[.445,75],[.46,65],[.477,50],[.5,0],[.6,-65],[.73,-65],[.87,-35],[1,-20]].map(([t,roll])=>({t,roll}));
      const amplitude=keys.length===4?0:keys.length===5?.20:keys.length===7?.72:1;
      const halfRelease=keys.length===7?hermite([[0,0],[.4,0],[.44,45],[.5,0],[.60,-35],[.68,-60],[.80,-35],[1,0]].map(([t,roll])=>({t,roll})),t,'roll'):0;o.rotation=orientation(o.direction,o.roll+rad(hermite(rollKeys,t,'roll'))*amplitude+rad(halfRelease));return o;
    }
  }
  class GolfAthlete {
    constructor(gltf,binding={}) {
      this.model=gltf.scene;this.binding=binding;this.bones={};this.skinMeshes=[];this.rest={};
      this.model.traverse(o=>{if(o.isBone){const n=o.name.replace(/(Clavicle|UpperArm|Forearm|Hand|Thigh|Shin|Foot)([LR])$/,'$1.$2').replace(/(Finger\d_\d)([LR])$/,'$1.$2');this.bones[n]=o;}if(o.isSkinnedMesh){this.skinMeshes.push(o);o.frustumCulled=false;}});
      for(const [canonical,name]of Object.entries(binding.bones||{})){const b=this.model.getObjectByName(name);if(b)this.bones[canonical]=b;}
      for(const n of ['Hips','Spine','Chest','Neck','Head','UpperArm.L','Forearm.L','Hand.L','UpperArm.R','Forearm.R','Hand.R','Thigh.L','Shin.L','Foot.L','Thigh.R','Shin.R','Foot.R'])if(!this.bones[n])throw Error('Golf rig mapping missing '+n);
      if(!this.skinMeshes.length)throw Error('Golf athlete requires a skinned human');
      this.model.updateMatrixWorld(true);
      this.model.traverse(o=>{if(o.isBone)this.rest[o.uuid]={p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),worldQ:o.getWorldQuaternion(new T.Quaternion()),worldP:o.getWorldPosition(V())};});
      this.restLengths={};this.feet={};this.footRotations={};
      for(const side of ['L','R']) {
        this.restLengths['arm'+side]=[this.bones['Forearm.'+side].position.length(),this.bones['Hand.'+side].position.length()];
        this.restLengths['leg'+side]=[this.bones['Shin.'+side].position.length(),this.bones['Foot.'+side].position.length()];
        this.feet[side]=this.model.worldToLocal(this.bones['Foot.'+side].getWorldPosition(V()));
        this.footRotations[side]=this.model.getWorldQuaternion(new T.Quaternion()).invert().multiply(this.bones['Foot.'+side].getWorldQuaternion(new T.Quaternion()));
      }
      this.clubSources={};
      for(const name of ['ClubGrip','ClubShaft','DriverHead','IronHead','PutterHead']) {
        const mesh=(binding.clubSource||this.model).getObjectByName(name);
        if(!mesh)throw Error('Golf club mesh missing '+name);
        let geometry=mesh.geometry.clone();
        if(mesh.isSkinnedMesh){const i=mesh.skeleton.bones.findIndex(b=>b===this.bones.Grip||b.name==='Grip');if(i<0)throw Error('Missing club bind joint');geometry.applyMatrix4(mesh.skeleton.boneInverses[i].clone().multiply(mesh.bindMatrix));}
        geometry.deleteAttribute('skinIndex');geometry.deleteAttribute('skinWeight');
        const make=m=>{const c=m.clone();c.skinning=false;return c;};
        this.clubSources[name]={geometry,material:Array.isArray(mesh.material)?mesh.material.map(make):make(mesh.material)};
      }
      this.model.traverse(o=>{if(o.isMesh&&(['ClubGrip','ClubShaft','DriverHead','IronHead','PutterHead'].includes(o.name)||/^Club[_ ]steel/.test(o.name))){o.visible=false;o.userData.legacyClub=true;}});
      this.grip=this.bones.Grip||new T.Object3D();if(!this.grip.parent){this.grip.name='GolfGrip';this.model.add(this.grip);this.bones.Grip=this.grip;}
      this.anchor=this.bones.ClubFaceAnchor||new T.Object3D();if(!this.anchor.parent){this.anchor.name='GolfContact';this.grip.add(this.anchor);this.bones.ClubFaceAnchor=this.anchor;}
      this.clubs=new Map();this.contactTarget=V();this.ball=V(0,.021335,.62);this.radius=.021335;this.handTargets={};this.footTargets={};this.current=null;this.style='full';this.frame=0;this.setClub({id:'7I',cat:'iron',loft:31.5});this.setContact(this.ball,this.radius);this.installForearmTwist();
    }
    // Keep elbow skin on the anatomical hinge. Pronation belongs progressively
    // down the forearm, not in a free three-axis elbow rotation.
    installForearmTwist() {
      // Six small twist intervals instead of blending identity against a 140°
      // distal frame: linear skinning otherwise pinches the forearm radius.
      this.forearmTwists={};this.forearmTwistChains={};const count=6;
      for(const side of ['L','R']){const parent=this.bones['Forearm.'+side],chain=[];for(let j=1;j<=count;j++){const bone=new T.Bone();bone.name='ForearmTwist.'+side+'.'+j;parent.add(bone);bone.updateWorldMatrix(true,false);chain.push(bone);}this.forearmTwistChains[side]=chain;this.forearmTwists[side]=chain[count-1];}
      const skeletons=new Map();this.twistSkinning={vertices:0,maxDroppedWeight:0,intervals:count};
      for(const mesh of this.skinMeshes){
        if(mesh.userData.legacyClub)continue;const source=mesh.skeleton;
        if(!skeletons.has(source)){const bones=[...source.bones],inverses=source.boneInverses.map(m=>m.clone());for(const side of ['L','R']){const i=source.bones.indexOf(this.bones['Forearm.'+side]);for(const bone of this.forearmTwistChains[side]){bones.push(bone);inverses.push(source.boneInverses[i].clone());}}skeletons.set(source,new T.Skeleton(bones,inverses));}
        mesh.skeleton=skeletons.get(source);mesh.geometry=mesh.geometry.clone();const g=mesh.geometry,oldI=g.attributes.skinIndex,oldW=g.attributes.skinWeight,indices=new Uint16Array(oldI.count*4),weights=new Float32Array(oldI.count*4),pos=g.attributes.position;
        const refs=['L','R'].map(side=>({side,index:source.bones.indexOf(this.bones['Forearm.'+side]),twists:this.forearmTwistChains[side].map(b=>mesh.skeleton.bones.indexOf(b)),length:this.restLengths['arm'+side][1]}));
        for(let i=0;i<oldI.count;i++){const map=new Map(),add=(id,w)=>{if(w>1e-9)map.set(id,(map.get(id)||0)+w);};for(let k=0;k<4;k++){const id=oldI.array[i*4+k],w=oldW.array[i*4+k],ref=refs.find(r=>r.index===id);if(!ref||!w){add(id,w);continue;}const p=V().fromBufferAttribute(pos,i).applyMatrix4(mesh.bindMatrix).applyMatrix4(source.boneInverses[id]),blend=smooth(.18,.88,p.y/ref.length)*count,lo=Math.floor(blend),hi=Math.min(count,lo+1),fraction=blend-lo;add(lo?ref.twists[lo-1]:id,w*(1-fraction));add(hi?ref.twists[hi-1]:id,w*fraction);if(blend>0)this.twistSkinning.vertices++;}const entries=[...map].sort((a,b)=>b[1]-a[1]),keep=entries.slice(0,4),sum=keep.reduce((n,x)=>n+x[1],0);this.twistSkinning.maxDroppedWeight=Math.max(this.twistSkinning.maxDroppedWeight,entries.slice(4).reduce((n,x)=>n+x[1],0));for(let k=0;k<4;k++){indices[i*4+k]=keep[k]?.[0]||0;weights[i*4+k]=(keep[k]?.[1]||0)/(sum||1);}}
        g.setAttribute('skinIndex',new T.Uint16BufferAttribute(indices,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(weights,4));
      }
    }
    static address(club,mode){return GolfMotion.address(club,mode);}
    static handFrame(side){const sign=side==='L'?1:-1;return new T.Quaternion().setFromAxisAngle(Y,sign*rad(85)).multiply(new T.Quaternion().setFromAxisAngle(Z,-sign*rad(25)));}
    setClub(club={}) {
      const id=CLUBS[club.id]?club.id:club.isPutter?'PT':'7I',spec=GolfMotion.club({...club,id}),key=id+':'+spec.loft;
      if(this.clubKey===key)return;
      this.clubKey=key;this.club={...club,id};this.spec=spec;this.headName=spec.head;this.lengthFactor=1;
      if(this.clubObject)this.clubObject.visible=false;
      if(!this.clubs.has(key))this.clubs.set(key,this.buildClub(spec,id));
      this.clubObject=this.clubs.get(key);this.clubObject.visible=true;this.shaftLength=this.clubObject.userData.shaftLength;this.headFloor=this.clubObject.userData.headFloor;this.heelOffset=this.clubObject.userData.heelOffset;
      this.anchor.position.set(0,this.shaftLength,0);this.anchor.scale.set(1,1,1);this.anchor.quaternion.identity();
    }
    buildClub(spec,id) {
      const root=new T.Group();root.name='CalibratedClub_'+id;this.grip.add(root);
      const wood=spec.head==='DriverHead',putt=spec.head==='PutterHead';
      const dimensions=wood?(id==='1W'?[.112,.058,.116]:id==='3W'?[.094,.044,.096]:[.088,.041,.090]):putt?[.034,.026,.110]:[this.club?.cat==='wedge'?.017:.013,.052*spec.size[1],.082*spec.size[2]];
      const headFloor=dimensions[1]/2,shaftLength=spec.length-headFloor,heelOffset=wood?.041:putt?.032:.033;
      const add=(name,geometry,material)=>{const o=new T.Mesh(geometry,material);o.name=name;o.castShadow=true;o.receiveShadow=true;root.add(o);return o;};
      const gripGeo=this.clubSources.ClubGrip.geometry.clone().translate(0,.010000023990869522,0);add('RigidGrip',gripGeo,this.clubSources.ClubGrip.material);
      const shaftGeo=this.clubSources.ClubShaft.geometry.clone(),p=shaftGeo.attributes.position;
      for(let i=0;i<p.count;i++)p.setY(i,.16+(p.getY(i)-.09999962896108627)/(1.0232194662094116-.09999962896108627)*(shaftLength-.16));p.needsUpdate=true;shaftGeo.computeVertexNormals();add('LengthCalibratedShaft',shaftGeo,this.clubSources.ClubShaft.material);
      const head=new T.Group();head.name='Rigid'+spec.head;head.position.y=shaftLength;head.rotation.x=rad(spec.lie)-Math.PI/2;root.add(head);
      this.buildHead(head,spec,id,dimensions,heelOffset);
      const sole=[];head.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)sole.push(V().fromBufferAttribute(p,i).add(o.position));});root.userData.solePoints=sole;
      const hosel=add('Hosel',new T.CylinderGeometry(.0065,.007,.034,12),this.clubSources.ClubShaft.material);hosel.position.y=shaftLength-.014;
      root.userData={...root.userData,shaftLength,headFloor,heelOffset,length:spec.length,lie:spec.lie,loft:spec.loft};return root;
    }
    buildHead(parent,spec,id,dimensions,heelOffset) {
      const [depth,height,width]=dimensions,wood=spec.head==='DriverHead',putt=spec.head==='PutterHead',tan=Math.tan(rad(spec.loft));
      const steel=new T.MeshStandardMaterial({color:putt?0xbcc0bb:0xb5b9b5,metalness:.88,roughness:.30}),faceMat=new T.MeshStandardMaterial({color:wood?0x626968:0xc4c8c2,metalness:.82,roughness:.39}),bodyMat=wood?new T.MeshStandardMaterial({color:0x171d1d,metalness:.35,roughness:.26}):steel;
      const poly=wood?Array.from({length:48},(_,i)=>{const a=i*Math.PI*2/48;return [Math.sin(a)*height/2,Math.cos(a)*width/2]}):[[.5,-.38],[.5,.38],[.37,.5],[-.35,.5],[-.5,.34],[-.46,-.35],[-.30,-.5],[.30,-.5]].map(([y,z])=>[y*height,z*width]).reverse();
      const make=(name,verts,indices,mat)=>{const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setIndex(indices);g.computeVertexNormals();const m=new T.Mesh(g,mat);m.name=name;m.position.z=heelOffset;m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;};
      const n=poly.length,front=[0,0,0],frontIndices=[];
      for(const[y,z]of poly)front.push(-tan*y,y,z);
      for(let i=0;i<n;i++)frontIndices.push(0,i+1,(i+1)%n+1);
      make('StrikingFace',front,frontIndices,faceMat);
      const rings=wood?[[.0008,1,1],[depth*.22,1.02,.99],[depth*.70,.78,.78],[depth,.24,.25],[depth*1.035,.03,.04]]:[[.0008,1,1],[depth*.18,1.02,1.01],[depth,.89,.96]],verts=[],indices=[];
      for(const[x,sy,sz]of rings)for(const[y,z]of poly)verts.push(x-tan*y*sy,y*sy,z*sz);
      for(let r=0;r<rings.length-1;r++)for(let i=0;i<n;i++){const a=r*n+i,b=(r+1)*n+i,c=(r+1)*n+(i+1)%n,d=r*n+(i+1)%n;indices.push(a,b,c,a,c,d)}
      const back=verts.length/3;verts.push(depth,0,0);for(let i=0;i<n;i++)indices.push(back,(rings.length-1)*n+(i+1)%n,(rings.length-1)*n+i);
      make(wood?'CarbonCrown':putt?'MilledBlade':'ForgedCavity',verts,indices,bodyMat);
      const grooveMat=new T.MeshStandardMaterial({color:0x424b46,metalness:.35,roughness:.8}),rows=putt?5:wood?7:9;
      const grooveVerts=[],grooveIndices=[];for(let i=0;i<rows;i++){const y=(i-(rows-1)/2)*height/(rows+2),w=width*(wood?.70:.72),h=.00038,b=grooveVerts.length/3;grooveVerts.push(-tan*(y-h)-.00012,y-h,-w/2,-tan*(y+h)-.00012,y+h,-w/2,-tan*(y+h)-.00012,y+h,w/2,-tan*(y-h)-.00012,y-h,w/2);grooveIndices.push(b,b+1,b+2,b,b+2,b+3)}make('FaceGrooves',grooveVerts,grooveIndices,grooveMat);
      if(putt){const line=new T.Mesh(new T.BoxGeometry(depth*.68,.00045,.0014),new T.MeshStandardMaterial({color:0xf0ebd8,roughness:.8}));line.name='PutterAlignment';line.position.set(depth*.45,-height*.505,heelOffset);parent.add(line);}
    }
    setGroundSampler(height,normal){this.groundHeight=height;this.groundNormal=normal;}
    setContact(localBall,radius) {
      this.ball.copy(localBall);this.radius=radius;
      const loft=rad(this.spec.loft);this.contactTarget.copy(localBall).add(V(-radius*Math.cos(loft),-radius*Math.sin(loft),0));
    }
    rotateWorld(bone,q){bone.quaternion.copy(bone.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));bone.updateWorldMatrix(true,true);}
    point(bone,direction){const q=bone.getWorldQuaternion(new T.Quaternion()),axis=Y.clone().applyQuaternion(q).normalize();this.rotateWorld(bone,new T.Quaternion().setFromUnitVectors(axis,direction.clone().normalize()).multiply(q));}
    ik(a,b,target,pole,lengths) {
      const upper=this.bones[a],lower=this.bones[b],start=upper.getWorldPosition(V()),delta=target.clone().sub(start),dist=clamp(delta.length(),Math.abs(lengths[0]-lengths[1])+.0001,lengths[0]+lengths[1]-.0001),direction=delta.normalize();
      const projected=pole.clone().addScaledVector(direction,-pole.dot(direction));if(projected.lengthSq()<1e-8)projected.copy(direction).cross(Z);projected.normalize();
      const along=(lengths[0]**2-lengths[1]**2+dist**2)/(2*dist),height=Math.sqrt(Math.max(0,lengths[0]**2-along**2)),elbow=start.clone().addScaledVector(direction,along).addScaledVector(projected,height);
      this.point(upper,elbow.clone().sub(start));this.point(lower,target.clone().sub(lower.getWorldPosition(V())));
    }
    arm(side,target,bodyPole) {
      const upper=this.bones['UpperArm.'+side],lower=this.bones['Forearm.'+side],hand=this.bones['Hand.'+side],lengths=this.restLengths['arm'+side];
      const start=upper.getWorldPosition(V()),delta=target.clone().sub(start),distance=clamp(delta.length(),Math.abs(lengths[0]-lengths[1])+.0001,lengths[0]+lengths[1]-.0001),axis=delta.normalize();
      const desired=this.handRotations[side].clone().multiply(this.rest[hand.uuid].q.clone().invert()),neutralY=Y.clone().applyQuaternion(desired);
      const project=v=>v.clone().addScaledVector(axis,-v.dot(axis));
      let pole=project(bodyPole);if(pole.lengthSq()<1e-9)pole=project(Z);pole.normalize();
      const previous=this._armState?.[side];
      if(previous) {
        const transport=new T.Quaternion().setFromUnitVectors(previous.axis,axis);
        pole=project(previous.pole.clone().applyQuaternion(transport)).normalize();
      }
      const along=(lengths[0]**2-lengths[1]**2+distance**2)/(2*distance),height=Math.sqrt(Math.max(0,lengths[0]**2-along**2));
      const best=project(neutralY).negate(),sine=best.length();
      if(height>.00001&&sine>.00001) {
        best.divideScalar(sine);
        const angle=Math.atan2(axis.dot(pole.clone().cross(best)),clamp(pole.dot(best),-1,1));
        const A=(distance-along)/lengths[1]*axis.dot(neutralY),B=height/lengths[1]*sine;
        const allowed=Math.acos(clamp((Math.cos(rad(side==='L'?22:32))-A)/B,-1,1));
        let turn=Math.max(0,Math.abs(angle)-allowed);
        if(previous) {
          const step=Math.max(0,this.frame/100-previous.t),limit=rad(30)*Math.min(1,step*100);
          const safety=Math.acos(clamp((Math.cos(rad(side==='L'?35:45))-A)/B,-1,1));
          turn=Math.max(Math.min(turn,limit),Math.abs(angle)-safety,0);
        }
        pole.applyAxisAngle(axis,Math.sign(angle)*turn);
      }
      const elbow=start.clone().addScaledVector(axis,along).addScaledVector(pole,height),upperDirection=elbow.clone().sub(start).normalize(),actual=target.clone().sub(elbow).normalize();
      const restLower=this.rest[lower.uuid].q,restZ=Y.clone().applyQuaternion(restLower).addScaledVector(Y,-Y.clone().applyQuaternion(restLower).dot(Y)).normalize(),restX=Y.clone().cross(restZ).normalize();
      const worldZ=actual.clone().addScaledVector(upperDirection,-actual.dot(upperDirection)).normalize(),worldX=upperDirection.clone().cross(worldZ).normalize();
      const restFrame=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(restX,Y,restZ));
      const upperQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(worldX,upperDirection,worldZ)).multiply(restFrame.invert());
      this.rotateWorld(upper,upperQ);
      this._armState=this._armState||{};this._armState[side]={t:this.frame/100,pole:pole.clone(),axis:axis.clone(),upperQ:upperQ.clone()};
      const base=upperQ.clone().multiply(restLower),neutral=new T.Quaternion().setFromUnitVectors(Y.clone().applyQuaternion(base),actual).multiply(base);
      this.rotateWorld(lower,neutral);
      const distal=new T.Quaternion().setFromUnitVectors(neutralY,actual).multiply(desired);
      this.forearmTwistChains[side].forEach((bone,i)=>this.rotateWorld(bone,neutral.clone().slerp(distal,(i+1)/this.forearmTwistChains[side].length))); 
      const twistQ=neutral.clone().invert().multiply(distal),addedTwist=Math.atan2(Math.sin(2*Math.atan2(twistQ.y,twistQ.w)),Math.cos(2*Math.atan2(twistQ.y,twistQ.w)));
      this.armDiagnostics=this.armDiagnostics||{};this.armDiagnostics[side]={addedTwist:addedTwist*180/Math.PI,hingeDot:restX.dot(upperDirection.clone().cross(actual).normalize().applyQuaternion(upperQ.clone().invert())),bendDegrees:T.MathUtils.radToDeg(upperDirection.angleTo(actual))};
      this.rotateWorld(hand,this.handRotations[side]);
    }
    constrainGrip(mode,t) {
      // Only remove unreachable / excessively folded targets, as one rigid grip.
      // Never reproject to an arbitrary circle branch or alter address/impact.
      if(t<1e-8||Math.abs(t-.5)<1e-8)return;
      const origin=this.grip.getWorldPosition(V()),target=origin.clone(),constraints=[];
      for(const side of ['L','R']) {
        const offset=this.handTargets[side].clone().sub(origin),center=this.bones['UpperArm.'+side].getWorldPosition(V()).sub(offset),[a,b]=this.restLengths['arm'+side];
        const leadLimit=side==='L'&&mode!=='putt'&&mode!=='chip'?T.MathUtils.lerp(32,125,smooth(.62,.88,t)):150;
        constraints.push({center,min:Math.sqrt(a*a+b*b+2*a*b*Math.cos(rad(leadLimit))),max:a+b-.0001});
      }
      for(let k=0;k<64;k++)for(const c of constraints){const d=target.clone().sub(c.center),r=d.length();if(r>1e-7)target.copy(c.center).addScaledVector(d,clamp(r,c.min,c.max)/r);}
      this.gripCorrection=target.distanceTo(origin);if(this.gripCorrection<1e-8)return;
      this.grip.position.copy(this.grip.parent.worldToLocal(target));this.model.updateMatrixWorld(true);this.gripHands();
    }
    bodyRotation(name,yaw,hinge,side=0) {
      const b=this.bones[name],q=new T.Quaternion().setFromEuler(new T.Euler(hinge,yaw,side,'YXZ')).multiply(this.rest[b.uuid].worldQ);
      this.rotateWorld(b,this.model.getWorldQuaternion(new T.Quaternion()).multiply(q));
    }
    footTarget(side,width,heel,chestYaw) {
      const f=this.feet[side].clone();f.x=(side==='L'?1:-1)*width/2;
      let q=this.footRotations[side].clone();
      if(side==='R'&&heel>0) {
        // Roll around the toe contact, not the ankle: heel lifts, toe stays grounded.
        const pivot=f.clone().add(V(0,-f.y+.006,.210)),roll=new T.Quaternion().setFromAxisAngle(V(1,0,0),rad(58)*heel),turn=new T.Quaternion().setFromAxisAngle(Y,Math.max(0,chestYaw)*.50*heel),rotation=turn.multiply(roll);
        f.sub(pivot).applyQuaternion(rotation).add(pivot);q.premultiply(rotation);
      } else if(side==='L')q.premultiply(new T.Quaternion().setFromAxisAngle(Y,rad(10)*smooth(0,.8,Math.max(0,chestYaw))));
      const world=this.model.localToWorld(f),base=this.model.localToWorld(V(f.x,0,f.z));
      if(this.groundHeight)world.y+=this.groundHeight(world.x,world.z)-base.y;
      if(this.groundNormal){const n=this.groundNormal(world.x,world.z).normalize().applyQuaternion(this.model.getWorldQuaternion(new T.Quaternion()).invert());q.premultiply(new T.Quaternion().setFromUnitVectors(Y,n));}
      return {position:world,rotation:this.model.getWorldQuaternion(new T.Quaternion()).multiply(q)};
    }
    gripHands() {
      const q=this.grip.getWorldQuaternion(new T.Quaternion()),origin=this.grip.getWorldPosition(V());this.handRotations={};
      for(const [side,sign,along]of [['L',1,.025],['R',-1,.095]]) {
        const handQ=GolfAthlete.handFrame(side);
        const calibration=this.binding.hands?.[side];if(calibration?.rotation)handQ.multiply(new T.Quaternion().setFromEuler(new T.Euler(...calibration.rotation)));
        const palm=calibration?.palm?V(...calibration.palm):V(sign*.010,.090,.026),wrist=V(0,calibration?.along??along,0).sub(palm.applyQuaternion(handQ));
        this.handTargets[side]=origin.clone().add(wrist.applyQuaternion(q));this.handRotations[side]=q.clone().multiply(handQ);
      }
    }
    fingers(side) {
      // A stable power grip; thumb opposition is separate from finger flexion.
      const hand=this.bones['Hand.'+side],hq=hand.getWorldQuaternion(new T.Quaternion()),sign=side==='L'?1:-1;
      for(let f=2;f<=5;f++)for(let s=1;s<=3;s++) {
        const b=this.bones[`Finger${f}_${s}.${side}`];if(!b)continue;
        const curl=[0,1.06,1.22,.98][s]+(f===5?.08:0);b.quaternion.copy(this.rest[b.uuid].q).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),curl));b.updateWorldMatrix(true,true);
      }
      const root=this.grip.getWorldPosition(V()),axis=Y.clone().applyQuaternion(this.grip.getWorldQuaternion(new T.Quaternion()));
      for(let s=1;s<=3;s++){const b=this.bones[`Finger1_${s}.${side}`];if(!b)continue;const at=b.getWorldPosition(V()),nearest=root.clone().addScaledVector(axis,at.clone().sub(root).dot(axis)),inward=nearest.sub(at).normalize();this.point(b,axis.clone().multiplyScalar(.96).addScaledVector(inward,.20));}
    }
    pose(mode,phase,p) {
      mode=this.club.isPutter?'putt':styleNames[mode]?mode:'full';
      const t=GolfMotion.time(phase,p),q=this.model.getWorldQuaternion(new T.Quaternion()),o=this.model.getWorldPosition(V());
      const key=[this.clubKey,mode,...this.ball.toArray(),...o.toArray(),...q.toArray()].map(v=>typeof v==='number'?Math.round(v*1e6)/1e6:v).join(':');
      if(this._poseCacheKey!==key){this._poseCacheKey=key;this._poseCache=[];}
      const clone=state=>Object.fromEntries(Object.entries(state||{}).map(([s,a])=>[s,{t:a.t,pole:a.pole.clone(),axis:a.axis.clone(),upperQ:a.upperQ.clone(),twist:a.twist}]));
      const frame=x=>x<=.4?['backswing',x/.4]:x<=.5?['downswing',(x-.4)/.1]:['followthrough',(x-.5)/.5];
      const n=Math.min(100,Math.floor(t*100+1e-7));
      // Canonical 1%-phase knots make the transported elbow/upper-arm frame
      // deterministic for normal play, arbitrary seeking, replay and export.
      for(let i=this._poseCache.length;i<=n;i++) {
        this._armState=i?clone(this._poseCache[i-1]):{};
        this._pose(mode,...frame(i/100));this._poseCache.push(clone(this._armState));
      }
      const exact=Math.abs(t-n/100)<1e-7;
      this._armState=exact?(n?clone(this._poseCache[n-1]):{}):clone(this._poseCache[n]);
      this._pose(mode,phase,p);
    }
    _pose(mode,phase,p) {
      mode=this.club.isPutter?'putt':styleNames[mode]?mode:'full';this.current=mode;this.style=mode;const t=GolfMotion.time(phase,p);this.frame=t*100;
      // Reset the skeleton; deterministic cached arm frames are reapplied explicitly.
      this.model.traverse(o=>{const r=this.rest[o.uuid];if(r){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}});
      this.grip.scale.set(1,1,1);this.model.updateMatrixWorld(true);
      const lie=rad(this.spec.lie),shaftAngle=rad(this.spec.addressAngle),addressLead=this.club.cat==='wood'?GolfMotion.address(this.club,mode).lead/(this.shaftLength-.055):0,d=V(addressLead,-Math.sin(shaftAngle)*Math.sqrt(1-addressLead*addressLead),Math.cos(shaftAngle)*Math.sqrt(1-addressLead*addressLead)),loft=rad(this.spec.loft),headY=this.ball.y-this.radius+this.headFloor+.002;
      const lean=mode==='putt'?0:this.club.cat==='wood'?.025:mode==='chip'?.11:mode==='punch'?.13:.075,impactD=V(-lean,-Math.sin(shaftAngle)*Math.sqrt(1-lean*lean),Math.cos(shaftAngle)*Math.sqrt(1-lean*lean));
      const fit=dir=>{
        const q=orientation(dir),headQ=q.clone().multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),lie-Math.PI/2)),normal=V(-Math.cos(loft),-Math.sin(loft),0).applyQuaternion(headQ).normalize(),contact=this.ball.clone().addScaledVector(normal,-this.radius);
        const lateral=V(0,0,this.heelOffset).applyQuaternion(headQ),z=this.ball.z-lateral.z;
        const origin=V(this.ball.x-(this.radius-normal.y*(this.ball.y-headY)-normal.z*(this.ball.z-z))/normal.x,headY,z);
        return {q,normal,contact,origin};
      };
      const addressFit=fit(d),impactFit=fit(impactD);
      // Rest the actual rigid sole on the sampled terrain, not on the ball's
      // underside (a teed ball is higher). Cache this fixed address geometry.
      const headQ=addressFit.q.clone().multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),lie-Math.PI/2)),sole=this.clubObject.userData.solePoints||[],worldBall=this.model.localToWorld(this.ball.clone());
      const ground=this.groundHeight?this.groundHeight(worldBall.x,worldBall.z):worldBall.y-this.radius,norm=this.groundNormal?this.groundNormal(worldBall.x,worldBall.z):Y;
      const soleKey=[this.clubKey,...this.ball.toArray(),...this.model.matrixWorld.elements,ground,...norm.toArray()].map(x=>typeof x==='number'?Math.round(x*1e6)/1e6:x).join(':');
      if(this._soleFit49?.key===soleKey)addressFit.origin.copy(this._soleFit49.origin);
      else if(sole.length){
        const groundY=this.model.worldToLocal(V(worldBall.x,ground,worldBall.z)).y;let minY=Infinity;for(const v of sole)minY=Math.min(minY,v.clone().applyQuaternion(headQ).y);
        addressFit.origin.y=groundY-minY+.001;
        for(let pass=0;pass<2;pass++){
          const n=addressFit.normal;addressFit.origin.x=this.ball.x-(this.radius-n.y*(this.ball.y-addressFit.origin.y)-n.z*(this.ball.z-addressFit.origin.z))/n.x;
          if(this.groundHeight){let lift=0;for(const v of sole){const w=this.model.localToWorld(v.clone().applyQuaternion(headQ).add(addressFit.origin));lift=Math.max(lift,this.groundHeight(w.x,w.z)+.001-w.y);}addressFit.origin.y+=lift/this.model.getWorldScale(V()).y;}
        }
        const n=addressFit.normal;addressFit.origin.x=this.ball.x-(this.radius-n.y*(this.ball.y-addressFit.origin.y)-n.z*(this.ball.z-addressFit.origin.z))/n.x;
        this._soleFit49={key:soleKey,origin:addressFit.origin.clone()};
      }
      const origin=addressFit.origin,butt=origin.clone().addScaledVector(d,-this.shaftLength),hand=butt.clone().addScaledVector(d,.055),impactH=impactFit.origin.clone().addScaledVector(impactD,-(this.shaftLength-.055));
      this.contactTarget.copy(impactFit.contact);this.impactNormal=impactFit.normal;
      const keys=GolfMotion.keys(mode,hand,d,impactH,impactD),m=GolfMotion.sample(keys,t),release=smooth(.65,1,t)*(mode==='putt'?0:mode==='chip'?.08:(mode==='half'||mode==='punch')?.55:1),address=GolfMotion.address(this.club,mode);
      const terrainDrop=clamp((this.radius-this.ball.y)*1.05,0,.14)*(this.isMPFB?1-release:1-smooth(hand.y+.16,hand.y+.46,m.hand.y));
      const stanceDrop=(this.club.cat==='wood'?.035:this.club.cat==='wedge'?.075:.062)+(mode==='chip'?.006:mode==='punch'?.004:0);
      const hip=this.bones.Hips,r=this.rest[hip.uuid];hip.position.copy(r.p);
      const setup49=GolfMotion.setups?.[this.club.id],setupDrop=(setup49?.drop||0)*(1-release),setupX=(setup49?.hipX||0)*(1-release);
      if(this.isMPFB)this.shiftHips(V(m.shift+setupX,-.055+release*.050-terrainDrop-setupDrop,-(mode==='putt'?.142:.072)*(1-release*.65)));
      else hip.position.add(V(m.shift,-stanceDrop+release*(stanceDrop-.005)-terrainDrop,-.018+release*.018));

      const baseHinge=clamp((mode==='putt'?.60:clamp(.40+(1.1557-this.spec.length)*.35,.40,.57))+(this.radius-this.ball.y)*.80,.45,.88);
      const hinge=baseHinge-release*(baseHinge-.13);
      this.bodyRotation('Hips',m.hip,.15-release*.10);this.bodyRotation('Spine',m.hip*.55+m.chest*.45,hinge*.67);this.bodyRotation('Chest',m.chest,hinge,((mode==='putt'?0:this.isMPFB?T.MathUtils.lerp(T.MathUtils.lerp(.29,-.24,smooth(.13,.39,t)),.28,smooth(.41,.5,t)):this.club.cat==='wood'?.10:.04)+(mode==='putt'?m.hand.x*1.1:0))*(1-release));
      this.bodyRotation('Neck',m.chest*(1-smooth(.52,.9,t))*.18,hinge*.78);
      const headLocal=this.model.worldToLocal(this.bones.Head.getWorldPosition(V())),gaze=this.ball.clone().sub(headLocal),gazeRelease=mode==='putt'||mode==='chip'?0:smooth(.57,.93,t),gazeYaw=Math.atan2(gaze.x,gaze.z),gazePitch=clamp(Math.atan2(-gaze.y,Math.hypot(gaze.x,gaze.z)),.65,1.15);
      this.bodyRotation('Head',T.MathUtils.lerp(gazeYaw,1.53,gazeRelease),T.MathUtils.lerp(gazePitch,.10,gazeRelease));
      this.model.updateMatrixWorld(true);
      if(this.isMPFB&&this.applyBodyPlan49)this.applyBodyPlan49(t,release);
      this.groundDrop=0;
      for(const side of ['L','R']) {
        const ft=this.footTarget(side,address.width,m.heel,m.chest).position,thigh=this.bones['Thigh.'+side].getWorldPosition(V()),max=this.restLengths['leg'+side].reduce((a,b)=>a+b,0)-.002;
        const horizontal=(ft.x-thigh.x)**2+(ft.z-thigh.z)**2,allowed=Math.sqrt(Math.max(.01,max*max-horizontal));
        this.groundDrop=Math.max(this.groundDrop,thigh.y-ft.y-allowed);
      }
      if(this.groundDrop>0&&!this._setupProbe49){if(this.isMPFB)this.shiftHips(V(0,-clamp(this.groundDrop,0,.09)*(this._bodyPlan49?smooth(.51,.65,t):1),0));else hip.position.y-=clamp(this.groundDrop,0,.09);this.model.updateMatrixWorld(true);}
      const buttPose=m.hand.clone().addScaledVector(m.direction,-.055);
      this.grip.position.copy(buttPose);this.grip.quaternion.copy(m.rotation);this.grip.scale.set(1,1,1);
      const headOffset=impactFit.contact.clone().sub(impactFit.origin).applyQuaternion(impactFit.q.clone().invert());this.anchor.position.copy(V(0,this.shaftLength,0).add(headOffset));this.anchor.scale.set(1,1,1);this.anchor.quaternion.identity();
      this.model.updateMatrixWorld(true);this.gripHands();
      // Keep the rigid grip/contact fixed; flex the knees on a lower ball lie
      // instead of stretching the trail arm away from its hand target.
      let armDrop=0;for(const side of ['L','R']){const shoulder=this.bones['UpperArm.'+side].getWorldPosition(V()),target=this.handTargets[side],max=this.restLengths['arm'+side].reduce((a,b)=>a+b,0)-.004,horizontal=(shoulder.x-target.x)**2+(shoulder.z-target.z)**2;if(shoulder.y>target.y&&horizontal<max*max)armDrop=Math.max(armDrop,shoulder.y-target.y-Math.sqrt(max*max-horizontal));}
      if(armDrop>0&&!this.isMPFB){if(this.isMPFB)this.shiftHips(V(0,-clamp(armDrop,0,.11),0));else hip.position.y-=clamp(armDrop,0,.11);this.model.updateMatrixWorld(true);}
      this.heelRelease=m.heel;this.bodyTurn={hips:m.hip,chest:m.chest};
      this.gripCorrection=0;this.constrainGrip(mode,t);
      const modelQ=this.model.getWorldQuaternion(new T.Quaternion());this.reachExcess=0;
      for(const [side,sign]of [['L',1],['R',-1]]) {
        const target=this.handTargets[side],shoulder=this.bones['UpperArm.'+side].getWorldPosition(V()),max=this.restLengths['arm'+side].reduce((a,b)=>a+b,0);
        this.reachExcess=Math.max(this.reachExcess,target.distanceTo(shoulder)-max);
        const bodyTurn=new T.Quaternion().setFromAxisAngle(Y,m.chest),pole=V(sign*.40,-.45,.30).applyQuaternion(bodyTurn).applyQuaternion(modelQ);
        this.arm(side,target,pole);this.fingers(side);
      }
      for(const [side,sign]of [['L',1],['R',-1]]) {
        const ft=this.footTarget(side,address.width,m.heel,m.chest);this.footTargets[side]=ft.position.clone();
        this.ik('Thigh.'+side,'Shin.'+side,ft.position,V(sign*.12,-.05,1).applyQuaternion(modelQ),this.restLengths['leg'+side]);this.rotateWorld(this.bones['Foot.'+side],ft.rotation);
      }
      this.heelRelease=m.heel;this.bodyTurn={hips:m.hip,chest:m.chest};this.model.updateMatrixWorld(true);for(const mesh of this.skinMeshes)mesh.skeleton.update();
    }
    walkPose(distance,speed,dt) {
      const modelQ=this.model.getWorldQuaternion(new T.Quaternion());
      if(!this._walkFeet){this._walkFeet={};for(const side of ['L','R'])this._walkFeet[side]={phase:(side==='L'?.30:.80),plant:this.bones['Foot.'+side].getWorldPosition(V()),rotation:this.bones['Foot.'+side].getWorldQuaternion(new T.Quaternion()),last:this.bones['Foot.'+side].getWorldPosition(V())};}
      this.model.traverse(o=>{const r=this.rest[o.uuid];if(r){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}});
      for(const side of ['L','R'])for(const b of this.forearmTwistChains[side])b.quaternion.identity();
      const cycle=distance/.50*.60,phase=cycle%1,bob=.009*(1-Math.cos(phase*Math.PI*4));
      if(this.isMPFB)this.shiftHips(V(0,-.055+bob*.7,0));else this.bones.Hips.position.y-=.055-bob*.7;this.bodyRotation('Hips',Math.sin(phase*Math.PI*2)*.035,.03);this.bodyRotation('Spine',0,.035);this.bodyRotation('Chest',-Math.sin(phase*Math.PI*2)*.03,.055);this.bodyRotation('Neck',0,0);this.bodyRotation('Head',0,.04);this.model.updateMatrixWorld(true);
      const footPoses=[];let legDrop=0;
      for(const[side,sign]of [['L',1],['R',-1]]){
        const ph=(cycle+(side==='R'?.80:.30))%1,f=this._walkFeet[side],ground=(x,z)=>this.groundHeight?this.groundHeight(x,z):this.model.position.y;
        if(ph<f.phase){f.plant.copy(f.last);f.rotation.copy(this.model.getWorldQuaternion(new T.Quaternion()).multiply(this.footRotations[side]));}
        let target=f.plant.clone(),rotation=f.rotation.clone();
        if(ph>=.6){if(f.phase<.6||!f.start)f.start=f.plant.clone();const u=(ph-.6)/.4,e=u*u*(3-2*u),end=this.model.localToWorld(V(sign*.155,this.feet[side].y,.23));end.y=ground(end.x,end.z)+this.feet[side].y;target.lerpVectors(f.start,end,e);target.y+=Math.sin(u*Math.PI)*.065;rotation.slerp(this.model.getWorldQuaternion(new T.Quaternion()).multiply(this.footRotations[side]),e);}
        else target.y=ground(target.x,target.z)+this.feet[side].y;
        const thigh=this.bones['Thigh.'+side].getWorldPosition(V()),max=this.restLengths['leg'+side].reduce((a,b)=>a+b,0)-.003,horizontal=(target.x-thigh.x)**2+(target.z-thigh.z)**2;legDrop=Math.max(legDrop,thigh.y-target.y-Math.sqrt(Math.max(.01,max*max-horizontal)));footPoses.push({side,sign,target,rotation});f.last.copy(target);f.phase=ph;
      }
      if(legDrop>0){if(this.isMPFB)this.shiftHips(V(0,-Math.min(.12,legDrop),0));else this.bones.Hips.position.y-=Math.min(.12,legDrop);this.model.updateMatrixWorld(true);}
      for(const{side,sign,target,rotation}of footPoses){this.ik('Thigh.'+side,'Shin.'+side,target,V(sign*.12,-.05,1).applyQuaternion(modelQ),this.restLengths['leg'+side]);this.rotateWorld(this.bones['Foot.'+side],rotation);}
      this.grip.position.set(.32,.98,.13);this.grip.quaternion.copy(orientation(V(.06,-.98,.13)));this.model.updateMatrixWorld(true);this.gripHands();
      const carrying=window.CaddieSystem?!!window.CaddieSystem.heldClub:!!this.club.isPutter;
      for(const[side,sign]of [['L',1],['R',-1]]){
        if(carrying&&side==='L'){this._armState={};this.arm(side,this.handTargets.L,V(.35,-.4,.3).applyQuaternion(modelQ));this.fingers(side);}
        else{const shoulder=this.bones['UpperArm.'+side].getWorldPosition(V()),target=shoulder.clone().add(V(sign*.035,-.49,.06+Math.sin(phase*Math.PI*2)*(side==='L'?-1:1)*.11).applyQuaternion(modelQ));this.ik('UpperArm.'+side,'Forearm.'+side,target,V(sign*.3,-.35,-.4).applyQuaternion(modelQ),this.restLengths['arm'+side]);this.rotateWorld(this.bones['Hand.'+side],this.bones['Forearm.'+side].getWorldQuaternion(new T.Quaternion()).multiply(this.rest[this.bones['Hand.'+side].uuid].q));}
      }
      this.model.updateMatrixWorld(true);for(const mesh of this.skinMeshes)mesh.skeleton.update();this.current='walk';
    }
    debug() {
      const point=n=>this.bones[n].getWorldPosition(V());return {version:this.isMPFB?'golfer41':'motion38',skinMeshes:this.skinMeshes.length,joints:this.isMPFB?new Set(this.skinMeshes.flatMap(m=>m.skeleton.bones)).size:Object.keys(this.bones).length,clips:Object.values(styleNames),style:this.style,frame:this.frame,head:this.headName,club:this.club.id,length:this.spec.length,lie:this.spec.lie,loft:this.spec.loft,clubScale:this.grip.scale.toArray(),contact:point('ClubFaceAnchor').toArray(),target:this.model.localToWorld(this.contactTarget.clone()).toArray(),wristErrors:['L','R'].map(s=>point('Hand.'+s).distanceTo(this.handTargets[s])),reachExcess:this.reachExcess,heelRelease:this.heelRelease,turn:this.bodyTurn,feet:['L','R'].map(s=>point('Foot.'+s).toArray()),footErrors:['L','R'].map(s=>point('Foot.'+s).distanceTo(this.footTargets[s]))};
    }
    dispose(){for(const c of this.clubs.values()){c.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Object.values(this.clubSources).some(s=>s.material===o.material)){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}});c.removeFromParent();}for(const s of Object.values(this.clubSources)){s.geometry.dispose();for(const m of Array.isArray(s.material)?s.material:[s.material])m.dispose();}}
  }
  window.GolfMotion=GolfMotion;window.GolfAthlete=GolfAthlete;
})();
