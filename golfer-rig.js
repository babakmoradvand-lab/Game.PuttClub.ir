/* Genuine skinned athlete. Five authored GLB clips plus two-link contact IK.
   No sprite, no photo plane, no rotation of an unrigged human mesh. */
(() => {
  'use strict';
  const T=THREE, Y=new T.Vector3(0,1,0);
  const clips={full:'FullSwing','three-quarter':'ThreeQuarter',half:'HalfSwing',chip:'Chip',putt:'Putt'};
  class GolfAthlete {
    constructor(gltf) {
      this.model=gltf.scene;this.bones={};this.skinMeshes=[];
      this.model.traverse(o=>{if(o.isBone){const name=o.name.replace(/(Clavicle|UpperArm|Forearm|Hand|Thigh|Shin|Foot)([LR])$/,'$1.$2').replace(/(Finger\d_\d)([LR])$/,'$1.$2');this.bones[name]=o;}if(o.isSkinnedMesh){this.skinMeshes.push(o);o.frustumCulled=false;}});
      if(!this.skinMeshes.length || !this.bones.Grip || !this.bones['Forearm.L'])throw Error('A skinned golfer and grip skeleton are required');
      this.mixer=new T.AnimationMixer(this.model);this.actions={};this.samplers={};
      for(const [mode,name] of Object.entries(clips)) {
        const clip=gltf.animations.find(c=>c.name===name);if(!clip)throw Error('Missing skeletal stroke '+name);
        const action=this.mixer.clipAction(clip);action.setLoop(T.LoopOnce,1);action.clampWhenFinished=true;this.actions[mode]=action;
        this.samplers[mode]=clip.tracks.map(track=>{const dot=track.name.lastIndexOf('.'),node=this.model.getObjectByName(track.name.slice(0,dot));if(!node)throw Error('Missing animation joint '+track.name);return {node,property:track.name.slice(dot+1),interpolant:track.createInterpolant()};});
      }
      this.contactOffset=new T.Vector3();this.current=null;this.frame=0;this.style='full';
      this.restLengths={};
      for(const side of ['L','R']) {
        this.restLengths['arm'+side]=[this.bones['Forearm.'+side].position.length(),this.bones['Hand.'+side].position.length()];
        this.restLengths['leg'+side]=[this.bones['Shin.'+side].position.length(),this.bones['Foot.'+side].position.length()];
      }
      this.model.updateMatrixWorld(true);
      this.feet={};this.footRotations={};
      for(const side of ['L','R']) {
        this.feet[side]=this.model.worldToLocal(this.bones['Foot.'+side].getWorldPosition(new T.Vector3()));
        const q=this.bones['Foot.'+side].getWorldQuaternion(new T.Quaternion());
        this.footRotations[side]=this.model.getWorldQuaternion(new T.Quaternion()).invert().multiply(q);
      }
      this.setClub({id:'1W',cat:'wood'});
    }
    setClub(club) {
      this.headName=club.isPutter?'PutterHead':club.cat==='wood'?'DriverHead':'IronHead';
      this.lengthFactor=club.isPutter ? 0.86 : club.id==='1W' ? 1 : club.cat==='wood' ? 0.96 : club.cat==='wedge' ? 0.85 : 0.90;
      for(const name of ['DriverHead','IronHead','PutterHead']) {
        const object=this.model.getObjectByName(name);if(object)object.visible=name===this.headName;
      }
    }
    setContact(localBall,radius) {
      // Native +X is the target/lead side, +Z faces the ball. The front face
      // touches the ball surface, not the centre; the feet remain planted.
      this.contactTarget=localBall.clone().add(new T.Vector3(-radius,0,0));
      this.contactOffset.copy(this.contactTarget).sub(new T.Vector3(0,.0235,.65));
    }
    rotateWorld(bone,q) {
      const parentQ=bone.parent.getWorldQuaternion(new T.Quaternion());
      bone.quaternion.copy(parentQ.invert().multiply(q));bone.updateWorldMatrix(true,true);
    }
    point(bone,direction) {
      const q=bone.getWorldQuaternion(new T.Quaternion());const axis=Y.clone().applyQuaternion(q).normalize();
      const delta=new T.Quaternion().setFromUnitVectors(axis,direction.clone().normalize());this.rotateWorld(bone,delta.multiply(q));
    }
    ik(a,b,target,pole,lengths) {
      const upper=this.bones[a],lower=this.bones[b],start=upper.getWorldPosition(new T.Vector3());
      const delta=target.clone().sub(start),dist=Math.max(.001,Math.min(delta.length(),lengths[0]+lengths[1]-.0001)),direction=delta.normalize();
      const projected=pole.clone().addScaledVector(direction,-pole.dot(direction));
      if(projected.lengthSq()<1e-8)projected.copy(direction).cross(Y);projected.normalize();
      const along=(lengths[0]**2-lengths[1]**2+dist**2)/(2*dist),height=Math.sqrt(Math.max(0,lengths[0]**2-along**2));
      const elbow=start.clone().addScaledVector(direction,along).addScaledVector(projected,height);
      this.point(upper,elbow.clone().sub(start));this.point(lower,target.clone().sub(lower.getWorldPosition(new T.Vector3())));
    }
    pose(mode,phase,p) {
      mode=mode==='putt'?'putt':(this.actions[mode]?mode:'full');
      this.current=mode;
      p=T.MathUtils.clamp(p||0,0,1);
      const frame=phase==='backswing'?40*p:phase==='downswing'?40+10*p:phase==='followthrough'?50+50*p:phase==='fade'?100:0;
      // Re-apply EVERY authored joint each sample. A Mixer skips unchanged values;
      // external contact IK must never accumulate on an idle cached mixer pose.
      for(const sampler of this.samplers[mode])sampler.node[sampler.property].fromArray(sampler.interpolant.evaluate(frame/60));
      this.frame=frame;this.style=mode;
      const grip=this.bones.Grip;grip.position.add(this.contactOffset);
      // Clubs shorten at the grip end, keeping the authored face path/contact.
      // Hands are solved onto the new grip; the player's feet/body do not shift.
      const length=1.0232216119766235,axisLocal=Y.clone().applyQuaternion(grip.quaternion);
      grip.position.addScaledVector(axisLocal,length*(1-this.lengthFactor));grip.scale.y*=this.lengthFactor;
      this.bones.Chest.quaternion.multiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),(1-this.lengthFactor)*.35));
      this.model.updateMatrixWorld(true);
      const modelQ=this.model.getWorldQuaternion(new T.Quaternion());
      const direction=Y.clone().applyQuaternion(grip.getWorldQuaternion(new T.Quaternion())).normalize();
      const centre=grip.getWorldPosition(new T.Vector3());this.handTargets={};
      // Shorter clubs require a small knee/hip adjustment, not stretched arms.
      // Solve reach first; foot IK below keeps both shoes on their stance points.
      for(let iteration=0;iteration<5;iteration++) {
        let adjustment=0;
        for(const [side,sign,offset] of [['L',1,-.035],['R',-1,.045]]) {
          const target=centre.clone().addScaledVector(direction,offset).add(new T.Vector3(sign*.024,0,0).applyQuaternion(modelQ));
          const delta=target.sub(this.bones['UpperArm.'+side].getWorldPosition(new T.Vector3()));
          const max=this.restLengths['arm'+side].reduce((a,b)=>a+b,0)-.0005,over=delta.length()-max;
          if(over>0) {
            const amount=T.MathUtils.clamp(over/Math.max(.3,Math.abs(delta.y)/delta.length()),0,.03)*Math.sign(delta.y);
            if(Math.abs(amount)>Math.abs(adjustment))adjustment=amount;
          }
        }
        if(Math.abs(adjustment)<1e-6)break;
        this.bones.Hips.position.y+=adjustment;this.model.updateMatrixWorld(true);
      }
      for(const [side,sign,offset] of [['L',1,-.035],['R',-1,.045]]) {
        const lateral=new T.Vector3(sign*.024,0,0).applyQuaternion(modelQ);
        const target=centre.clone().addScaledVector(direction,offset).add(lateral);this.handTargets[side]=target;
        const pole=new T.Vector3(sign*.45,-.10,-.32).applyQuaternion(modelQ);
        this.ik('UpperArm.'+side,'Forearm.'+side,target,pole,this.restLengths['arm'+side]);
        const inward=new T.Vector3(-sign,0,0).applyQuaternion(modelQ);
        const z=inward.addScaledVector(direction,-inward.dot(direction)).normalize();
        const x=direction.clone().cross(z).normalize();z.copy(x).cross(direction).normalize();
        const q=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,direction,z));
        this.rotateWorld(this.bones['Hand.'+side],q);
      }
      for(const [side,sign] of [['L',1],['R',-1]]) {
        const target=this.model.localToWorld(this.feet[side].clone());
        const pole=new T.Vector3(sign*.1,0,1).applyQuaternion(modelQ);
        this.ik('Thigh.'+side,'Shin.'+side,target,pole,this.restLengths['leg'+side]);
        this.rotateWorld(this.bones['Foot.'+side],modelQ.clone().multiply(this.footRotations[side]));
      }
      this.model.updateMatrixWorld(true);
      // Make static bounds irrelevant to moving skinned limbs; renderer updates
      // the real joint palette. No second visible character or detached club.
      for(const mesh of this.skinMeshes)mesh.skeleton.update();
    }
    debug() {
      const point=name=>this.bones[name].getWorldPosition(new T.Vector3());
      return {version:'rig10',skinMeshes:this.skinMeshes.length,joints:Object.keys(this.bones).length,clips:Object.values(clips),style:this.style,frame:this.frame,head:this.headName,
        contact:point('ClubFaceAnchor').toArray(),target:this.contactTarget?this.model.localToWorld(this.contactTarget.clone()).toArray():null,
        wristErrors:['L','R'].map(side=>point('Hand.'+side).distanceTo(this.handTargets[side])),
        feet:['L','R'].map(side=>point('Foot.'+side).toArray())};
    }
  }
  window.GolfAthlete=GolfAthlete;
})();
