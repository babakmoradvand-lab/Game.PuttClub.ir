/* Putt Club swing25. Existing skinned human, metre-calibrated rigid clubs.
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
    const va=a[field],vb=b[field],ma=i===0?0:(b[field]-prev[field])/(b.t-prev.t),mb=i+1===keys.length-1?0:(next[field]-a[field])/(next.t-a.t);
    return (2*u3-3*u2+1)*va+(u3-2*u2+u)*dt*ma+(-2*u3+3*u2)*vb+(u3-u2)*dt*mb;
  }
  function orientation(direction,roll=0) {
    const y=direction.clone().normalize(),z=Z.clone().addScaledVector(y,-Z.dot(y)).normalize(),x=y.clone().cross(z).normalize();
    return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z)).multiply(new T.Quaternion().setFromAxisAngle(Y,roll));
  }
  class GolfMotion {
    static club(club={}) {const s=CLUBS[club.id]||CLUBS[club.isPutter?'PT':'7I'];return {...s,size:s.size.slice(),addressAngle:club.id==='1W'?47.5:club.id==='3W'?52.5:club.id==='5W'?53.5:club.isPutter||club.id==='PT'?70:club.cat==='wedge'?60:s.lie-5,loft:Number.isFinite(club.loft)?club.loft:s.loft};}
    static address(club={},mode='full') {
      const s=GolfMotion.club(club),putt=!!club.isPutter||mode==='putt';
      return {distance:(s.length-.12)*Math.cos(rad(s.addressAngle))+(putt?.23:.25),lead:putt?0:club.id==='1W'?.10:club.cat==='wood'?.055:club.cat==='wedge'?-.018:0,width:putt?.29:mode==='chip'?.29:club.cat==='wood'?.46:.39};
    }
    static time(phase,p){p=clamp(p||0,0,1);return phase==='backswing'?.4*p:phase==='downswing'?.4+.1*p:phase==='followthrough'?.5+.5*p:phase==='fade'?1:0;}
    static keys(mode,h,d,impactH,impactD) {
      const k=(t,pos,dir,hip,chest,shift=0,heel=0,roll=0)=>({t,hx:pos[0],hy:pos[1],hz:pos[2],dx:dir[0],dy:dir[1],dz:dir[2],hip,chest,shift,heel,roll});
      const a=h.toArray(),di=d.toArray(),ih=impactH.toArray(),id=impactD.toArray();
      if(mode==='putt')return [k(0,a,di,0,0),k(.4,[a[0]-.075,a[1]+.006,a[2]],[-.10,di[1],di[2]],0,0),k(.5,a,di,0,0),k(1,[a[0]+.09,a[1]+.009,a[2]],[.12,di[1],di[2]],0,0)];
      if(mode==='chip')return [k(0,a,di,.04,.04,.015),k(.4,[a[0]-.15,a[1]+.07,a[2]-.015],[-.38,-.82,.42],-.12,-.22,0),k(.5,ih,id,.16,.12,.035),k(.72,[a[0]+.16,a[1]+.075,a[2]-.015],[.38,-.83,.40],.24,.30,.045),k(1,[a[0]+.24,a[1]+.12,a[2]-.025],[.52,-.73,.43],.28,.40,.05)];
      if(mode==='half'||mode==='punch')return [k(0,a,di,0,0),k(.22,[-.24,a[1]+.10,a[2]-.03],[-.88,-.30,.36],-.18,-.40,-.012),k(.4,mode==='punch'?[-.37,1.13,.15]:[-.36,1.07,.17],mode==='punch'?[-.30,.94,.18]:[-.58,.79,.20],-.32,-.78,-.025),k(.45,[-.28,1.01,.19],[-.86,.38,.34],-.05,-.55,0),k(.5,ih,id,.34,.15,.04),k(.68,[.29,1.03,.18],[.81,.44,.39],.54,.65,.055,.12,-.15),k(1,mode==='punch'?[.40,1.08,.16]:[.37,1.18,.10],mode==='punch'?[.78,.56,.27]:[.10,.98,-.12],.68,.88,.065,.24,-.30)];
      const three=mode==='three-quarter';
      return [k(0,a,di,0,0),k(.13,[-.20,Math.max(.94,a[1]+.13),a[2]-.035],[-.94,-.09,.32],-.10,-.30,-.012),k(.28,[-.40,1.17,.09],[-.30,.92,.25],-.38,-.96,-.028),k(.365,three?[-.41,1.28,.02]:[-.43,1.40,.015],three?[.28,.94,-.18]:[.91,.28,-.30],-.60,three?-1.16:-1.40,-.032),k(.4,three?[-.40,1.29,.02]:[-.42,1.42,.015],three?[.35,.92,-.18]:[.94,.16,-.30],-.55,three?-1.20:-1.45,-.025),k(.445,[-.37,1.21,.07],[.12,.97,-.20],-.12,three?-.95:-1.10,.006),k(.477,[-.24,.98,.20],[-.91,.14,.39],.25,-.48,.035),k(.5,ih,id,.55,.20,.055,.025),k(.60,[.30,1.03,.20],[.93,.10,.35],.82,.72,.07,.30,-.18),k(.73,[.42,1.29,.055],[.30,.94,-.16],1,1.21,.08,.64,-.55),k(.87,three?[.28,1.38,-.025]:[.23,1.47,-.04],three?[-.44,.83,-.34]:[-.80,.32,-.50],1.10,three?1.40:1.52,.085,.90,-.90),k(1,three?[.25,1.40,-.035]:[.20,1.48,-.065],three?[-.55,.72,-.42]:[-.90,-.12,-.42],1.12,three?1.43:1.56,.085,1,-1.05)];
    }
    static sample(keys,t) {
      const o={};for(const f of ['hx','hy','hz','dx','dy','dz','hip','chest','shift','heel','roll'])o[f]=hermite(keys,t,f);
      o.hand=V(o.hx,o.hy,o.hz);o.direction=V(o.dx,o.dy,o.dz).normalize();o.rotation=orientation(o.direction,o.roll);return o;
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
      this.model.traverse(o=>{if(o.isBone)this.rest[o.uuid]={p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone(),worldQ:o.getWorldQuaternion(new T.Quaternion())};});
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
      this.clubs=new Map();this.contactTarget=V();this.ball=V(0,.021335,.62);this.radius=.021335;this.handTargets={};this.footTargets={};this.current=null;this.style='full';this.frame=0;this.setClub({id:'7I',cat:'iron',loft:31.5});this.setContact(this.ball,this.radius);
    }
    static address(club,mode){return GolfMotion.address(club,mode);}
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
      const hosel=add('Hosel',new T.CylinderGeometry(.0065,.007,.034,12),this.clubSources.ClubShaft.material);hosel.position.y=shaftLength-.014;
      root.userData={shaftLength,headFloor,heelOffset,length:spec.length,lie:spec.lie,loft:spec.loft};return root;
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
      if(this.groundNormal){const n=this.groundNormal(world.x,world.z).normalize();q.premultiply(new T.Quaternion().setFromUnitVectors(Y,n));}
      return {position:world,rotation:this.model.getWorldQuaternion(new T.Quaternion()).multiply(q)};
    }
    gripHands() {
      const q=this.grip.getWorldQuaternion(new T.Quaternion()),origin=this.grip.getWorldPosition(V());this.handRotations={};
      for(const [side,sign,along]of [['L',1,.025],['R',-1,.095]]) {
        const handQ=new T.Quaternion().setFromAxisAngle(Y,sign*Math.PI/2).multiply(new T.Quaternion().setFromAxisAngle(Z,-sign*rad(68)));
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
      for(const [s,d]of [[1,[-sign*.58,.74,.34]],[2,[-sign*.68,.72,.12]],[3,[-sign*.68,.67,-.28]]]){const b=this.bones[`Finger1_${s}.${side}`];if(b)this.point(b,V(...d).applyQuaternion(hq));}
    }
    pose(mode,phase,p) {
      mode=this.club.isPutter?'putt':styleNames[mode]?mode:'full';this.current=mode;this.style=mode;const t=GolfMotion.time(phase,p);this.frame=t*100;
      // Reset to bind pose, never feed previous IK output back into the next frame.
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
      const addressFit=fit(d),impactFit=fit(impactD),origin=addressFit.origin,butt=origin.clone().addScaledVector(d,-this.shaftLength),hand=butt.clone().addScaledVector(d,.055),impactH=impactFit.origin.clone().addScaledVector(impactD,-(this.shaftLength-.055));
      this.contactTarget.copy(impactFit.contact);this.impactNormal=impactFit.normal;
      const keys=GolfMotion.keys(mode,hand,d,impactH,impactD),m=GolfMotion.sample(keys,t),release=smooth(.65,1,t)*(mode==='putt'?0:mode==='chip'?.08:(mode==='half'||mode==='punch')?.55:1),address=GolfMotion.address(this.club,mode);
      const terrainDrop=clamp((this.radius-this.ball.y)*1.05,0,.14)*(1-smooth(hand.y+.16,hand.y+.46,m.hand.y));
      const stanceDrop=(this.club.cat==='wood'?.008:this.club.cat==='wedge'?.049:.032)+(mode==='chip'?.006:mode==='punch'?.004:0);
      const hip=this.bones.Hips,r=this.rest[hip.uuid];hip.position.copy(r.p).add(V(m.shift,-stanceDrop+release*(stanceDrop-.005)-terrainDrop,-.018+release*.018));
      const baseHinge=clamp((mode==='putt'?.78:clamp(.52+(1.1557-this.spec.length)*.85,.52,.77))+(this.radius-this.ball.y)*.80,.45,.88);
      const hinge=baseHinge-release*(baseHinge-.13);
      this.bodyRotation('Hips',m.hip,.15-release*.10);this.bodyRotation('Spine',m.hip*.55+m.chest*.45,hinge*.67);this.bodyRotation('Chest',m.chest,hinge,((mode==='putt'?.11:.24)+(mode==='putt'?m.hand.x*1.1:0))*(1-release));
      this.bodyRotation('Neck',m.chest*(1-smooth(.52,.9,t))*.18,hinge*.78);
      const headLocal=this.model.worldToLocal(this.bones.Head.getWorldPosition(V())),gaze=this.ball.clone().sub(headLocal),gazeRelease=mode==='putt'||mode==='chip'?0:smooth(.57,.93,t),gazeYaw=Math.atan2(gaze.x,gaze.z),gazePitch=clamp(Math.atan2(-gaze.y,Math.hypot(gaze.x,gaze.z)),.65,1.15);
      this.bodyRotation('Head',T.MathUtils.lerp(gazeYaw,1.53,gazeRelease),T.MathUtils.lerp(gazePitch,.10,gazeRelease));
      this.model.updateMatrixWorld(true);
      this.groundDrop=0;
      for(const side of ['L','R']) {
        const ft=this.footTarget(side,address.width,m.heel,m.chest).position,thigh=this.bones['Thigh.'+side].getWorldPosition(V()),max=this.restLengths['leg'+side].reduce((a,b)=>a+b,0)-.002;
        const horizontal=(ft.x-thigh.x)**2+(ft.z-thigh.z)**2,allowed=Math.sqrt(Math.max(.01,max*max-horizontal));
        this.groundDrop=Math.max(this.groundDrop,thigh.y-ft.y-allowed);
      }
      if(this.groundDrop>0){hip.position.y-=clamp(this.groundDrop,0,.09);this.model.updateMatrixWorld(true);}
      const buttPose=m.hand.clone().addScaledVector(m.direction,-.055);
      this.grip.position.copy(buttPose);this.grip.quaternion.copy(m.rotation);this.grip.scale.set(1,1,1);
      const headOffset=impactFit.contact.clone().sub(impactFit.origin).applyQuaternion(impactFit.q.clone().invert());this.anchor.position.copy(V(0,this.shaftLength,0).add(headOffset));this.anchor.scale.set(1,1,1);this.anchor.quaternion.identity();
      this.model.updateMatrixWorld(true);this.gripHands();
      const modelQ=this.model.getWorldQuaternion(new T.Quaternion());this.reachExcess=0;
      for(const [side,sign]of [['L',1],['R',-1]]) {
        const target=this.handTargets[side],shoulder=this.bones['UpperArm.'+side].getWorldPosition(V()),max=this.restLengths['arm'+side].reduce((a,b)=>a+b,0);
        this.reachExcess=Math.max(this.reachExcess,target.distanceTo(shoulder)-max);
        const bodyTurn=new T.Quaternion().setFromAxisAngle(Y,m.chest),pole=V(sign*.40,-.18,.56).applyQuaternion(bodyTurn).applyQuaternion(modelQ);
        this.ik('UpperArm.'+side,'Forearm.'+side,target,pole,this.restLengths['arm'+side]);this.rotateWorld(this.bones['Hand.'+side],this.handRotations[side]);this.fingers(side);
      }
      for(const [side,sign]of [['L',1],['R',-1]]) {
        const ft=this.footTarget(side,address.width,m.heel,m.chest);this.footTargets[side]=ft.position.clone();
        this.ik('Thigh.'+side,'Shin.'+side,ft.position,V(sign*.12,-.05,1).applyQuaternion(modelQ),this.restLengths['leg'+side]);this.rotateWorld(this.bones['Foot.'+side],ft.rotation);
      }
      this.heelRelease=m.heel;this.bodyTurn={hips:m.hip,chest:m.chest};this.model.updateMatrixWorld(true);for(const mesh of this.skinMeshes)mesh.skeleton.update();
    }
    debug() {
      const point=n=>this.bones[n].getWorldPosition(V());return {version:'swing25',skinMeshes:this.skinMeshes.length,joints:Object.keys(this.bones).length,clips:Object.values(styleNames),style:this.style,frame:this.frame,head:this.headName,club:this.club.id,length:this.spec.length,lie:this.spec.lie,loft:this.spec.loft,clubScale:this.grip.scale.toArray(),contact:point('ClubFaceAnchor').toArray(),target:this.model.localToWorld(this.contactTarget.clone()).toArray(),wristErrors:['L','R'].map(s=>point('Hand.'+s).distanceTo(this.handTargets[s])),reachExcess:this.reachExcess,heelRelease:this.heelRelease,turn:this.bodyTurn,feet:['L','R'].map(s=>point('Foot.'+s).toArray()),footErrors:['L','R'].map(s=>point('Foot.'+s).distanceTo(this.footTargets[s]))};
    }
    dispose(){for(const c of this.clubs.values()){c.traverse(o=>{if(o.isMesh){o.geometry.dispose();if(!Object.values(this.clubSources).some(s=>s.material===o.material)){for(const m of Array.isArray(o.material)?o.material:[o.material])m.dispose();}}});c.removeFromParent();}for(const s of Object.values(this.clubSources)){s.geometry.dispose();for(const m of Array.isArray(s.material)?s.material:[s.material])m.dispose();}}
  }
  window.GolfMotion=GolfMotion;window.GolfAthlete=GolfAthlete;
})();
