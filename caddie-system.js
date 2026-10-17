/* Caddie31 — real skinned human, one physical instance of each calibrated club.
 * Human base and source Walk/Idle: Microsoft Rocketbox, MIT (see characters/LICENSE.txt).
 * Equipment FSM is separate from GolfMotion and the shot integrator. */
(() => {
'use strict';
const T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0),clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const actor=new T.Group();actor.name='PuttClubHumanCaddie';actor.visible=false;scene.add(actor);
const carrier=new T.Group();carrier.name='ActualClubInExchange';scene.add(carrier);
const state={loaded:false,initialized:false,phase:'loading',time:0,held:null,active:null,purpose:null,pending:null,struck:false,lowerTime:0};
const diagnostics={version:'caddie31',source:'Microsoft Rocketbox Female_Adult_01 / MIT',events:[],transfers:0,handError:0,finite:true,pathFailures:0};
let model,mixer,idle,walk,bones={},slots=[],clubs=[],owners=[],path=[],pathGoal=null,restCallback=null,savedEquipment=null,finishPose=null,poseRelease=1,lastBall=V(Infinity,0,0),holeKey='',stageStart=null,stageEnd=null,grasp=.07,walking=false,navRetry=0;
const animationPose=new Map();
let handoffGripReference=null,handoffGoal=null,approachStaged=false,egressPoint=null,handoffLift=0,currentObstacles=[],addressObstacles=[],strapGeometry=null,strapMesh=null,strapAnchor=null;
const originalRest={},footClearance={},handAxes={},tempQ=new T.Quaternion();
function event(name,index=state.active){diagnostics.events.push({event:name,club:index,phase:state.phase,stroke:strokesCurrentHole});if(diagnostics.events.length>160)diagnostics.events.shift();}
function phase(name){if(name==='deliver-approach'||name==='return-approach'){handoffGoal=null;handoffGripReference=null;approachStaged=false;}state.phase=name;state.time=0;stageStart=null;stageEnd=null;event(name);window.PuttUI?.updateShotState(true);if(['ready','empty'].includes(name)&&canAdjustAim())updateAimTracer();}
function worldPose(o){o.updateWorldMatrix(true,false);return{p:o.getWorldPosition(V()),q:o.getWorldQuaternion(new T.Quaternion())};}
function setWorld(o,p,q){o.parent.updateWorldMatrix(true,false);o.position.copy(o.parent.worldToLocal(p.clone()));o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));o.scale.set(1,1,1);o.updateMatrixWorld(true);}
function putInBag(i){const o=clubs[i];slots[i].add(o);o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);owners[i]='bag';o.visible=true;event('stored-in-bag',i);}
function takeCarrier(i){const pose=worldPose(clubs[i]);carrier.add(clubs[i]);setWorld(clubs[i],pose.p,pose.q);owners[i]='caddie';state.active=i;diagnostics.transfers++;event('caddie-took-physical-club',i);}
function giveGolfer(i){const a=proGolferAnimator;a.grip.add(clubs[i]);clubs[i].position.set(0,0,0);clubs[i].quaternion.identity();clubs[i].scale.set(1,1,1);owners[i]='golfer';state.held=i;poseRelease=0;a.setClub(GOLF_BAG[i]);diagnostics.transfers++;event('delivered-to-golfer',i);}
function syncClubs(){if(!state.initialized)return;for(let i=0;i<clubs.length;i++)clubs[i].visible=true;}
function distance(){return Math.hypot(actor.position.x-golferGroup.position.x,actor.position.z-golferGroup.position.z);}
// Both the current body and its address pose are reserved: receiving a club
// bends the golfer forward, so the approach must not rely on relaxed-head space.
function bodyObstacles(){const b=proGolferAnimator?.bones;if(!b)return[];const at=n=>b[n].getWorldPosition(V());return[[at('Hips'),at('Chest'),.22],[at('Chest'),at('Neck'),.12],[at('Head'),at('Head'),.14],[at('Hips'),at('Foot.L'),.11],[at('Hips'),at('Foot.R'),.11]];}
function pointSegmentXZ(p,a,b){const x=b.x-a.x,z=b.z-a.z,d=x*x+z*z,t=d?clamp(((p.x-a.x)*x+(p.z-a.z)*z)/d,0,1):0;return Math.hypot(p.x-a.x-t*x,p.z-a.z-t*z);}
function handoffYaw(p){const g=proGolferAnimator.grip.getWorldPosition(V()),d=Math.hypot(g.x-p.x,g.z-p.z);return Math.atan2(g.x-p.x,g.z-p.z)+Math.asin(clamp(.17/Math.max(.2,d),0,.55));}
function bodyClearance(p,yaw=handoffYaw(p)){
 const q=new T.Quaternion().setFromAxisAngle(Y,yaw),bag=p.clone().add(V(-.28,0,-.065).applyQuaternion(q));let gap=Infinity;
 for(const[a,b,r]of [...addressObstacles,...(currentObstacles.length?currentObstacles:bodyObstacles())]){const head=a===b||a.distanceToSquared(b)<1e-8,personRadius=head?.15:r<=.11?.19:r<=.12?.18:.24;gap=Math.min(gap,pointSegmentXZ(p,a,b)-r-personRadius-.04,pointSegmentXZ(bag,a,b)-r-.19-.04);}
 return gap;
}
function clearGround(p,park=false){
 if(proGolferAnimator&&bodyClearance(p)<0)return false;
 if(!isPuttClub())return true;const pc=window.PuttClubCourse;
 for(const[x,z]of [[0,0],[.24,0],[-.24,0],[0,.24],[0,-.24]])if(pc.areaAt(V(p.x+x,0,p.z+z)))return false;
 if(park&&pc.surface(p.x,p.z).type==='bunker')return false;
 for(const i of pc.treeCandidates(p,p)){const t=pc.trees.instances[i];if(Math.hypot(t.position[0]-p.x,t.position[2]-p.z)<.68)return false;}
 return true;
}
function safePlace(){const side=V(aimDirection.z,0,-aimDirection.x),base=golferGroup.position;
 const candidates=[[4.2,-1.4],[-4.2,-1.4],[3.2,-3.4],[-3.2,-3.4],[0,-4.8],[5.2,0],[-5.2,0],[4,3],[-4,3]];
 for(const[x,z]of candidates){const p=base.clone().addScaledVector(side,x).addScaledVector(aimDirection,z);if(clearGround(p,true)){p.y=getTerrainHeight(p.x,p.z);return p;}}
 for(let r=5;r<=12;r+=1)for(let k=0;k<16;k++){const p=base.clone().add(V(Math.sin(k*Math.PI/8)*r,0,Math.cos(k*Math.PI/8)*r));if(clearGround(p,true)){p.y=getTerrainHeight(p.x,p.z);return p;}}
 return base.clone().addScaledVector(side,4.5);
}
function handoffPlace(){
 const p=proGolferAnimator.grip.getWorldPosition(V()),face=V(aimDirection.z,0,-aimDirection.x);
 for(const radius of [.39,.42,.45])for(const angle of [0,.35,-.35,.7,-.7,1.2,-1.2,1.6,-1.6,2,-2,2.5,-2.5,Math.PI]){const q=p.clone().addScaledVector(face.clone().applyAxisAngle(Y,angle),radius);q.y=getTerrainHeight(q.x,q.z);if(clearGround(q))return q;}
 // Never fall back to an occupied point. Wait safely and retry instead.
 return null;
}

function plan(goal){
 pathGoal=goal.clone();const start=actor.position.clone(),segment=(a,b)=>{const n=Math.ceil(a.distanceTo(b)/.22);for(let i=1;i<=n;i++){const p=a.clone().lerp(b,i/n);if(!clearGround(p)||Math.abs(getTerrainHeight(p.x,p.z)-getTerrainHeight(a.x,a.z))>Math.max(.6,a.distanceTo(p)*.65))return false;}return true;};
 if(segment(start,goal)){path=[goal.clone()];return true;}
 // Small local A*: navigation for this person only; never a shot/path planner.
 const step=.5,origin=start.clone().add(V(-10,0,-10)),size=41,key=(x,z)=>z*size+x,pos=(x,z)=>V(origin.x+x*step,0,origin.z+z*step),sx=20,sz=20,gx=clamp(Math.round((goal.x-origin.x)/step),0,40),gz=clamp(Math.round((goal.z-origin.z)/step),0,40),open=[{x:sx,z:sz,g:0,f:0}],best=new Map([[key(sx,sz),0]]),came=new Map();let end=null;
 for(let tries=0;open.length&&tries<1600;tries++){open.sort((a,b)=>a.f-b.f);const n=open.shift(),id=key(n.x,n.z);if(Math.hypot(pos(n.x,n.z).x-goal.x,pos(n.x,n.z).z-goal.z)<step*.9&&segment(pos(n.x,n.z),goal)){end=id;break;}for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,z=n.z+dz;if(x<0||z<0||x>=size||z>=size)continue;const q=pos(x,z),prev=pos(n.x,n.z);if(!clearGround(q)||!segment(prev,q))continue;const g=n.g+Math.hypot(dx,dz),k=key(x,z);if(g>=(best.get(k)??Infinity))continue;best.set(k,g);came.set(k,id);open.push({x,z,g,f:g+Math.hypot(gx-x,gz-z)});}}
 if(end!==null){const out=[goal.clone()];for(let id=end;id!==key(sx,sz);id=came.get(id)){if(id===undefined)break;out.push(pos(id%size,Math.floor(id/size)));}path=out.reverse();return true;}
 diagnostics.pathFailures++;event('no-safe-path');path=[];return false;
}
function move(goal,dt){navRetry=Math.max(0,navRetry-dt);const gap=Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z);if(!pathGoal||pathGoal.distanceTo(goal)>.30||(!path.length&&gap>=.008&&navRetry===0)){navRetry=plan(goal)?0:.75;}diagnostics.navigation={goal:goal.toArray(),path:path.length};let remaining=dt*1.55;walking=false;
 while(path.length&&remaining>0){const q=path[0],d=V(q.x-actor.position.x,0,q.z-actor.position.z),len=d.length();if(len<.005){path.shift();continue;}const n=Math.min(len,remaining),next=actor.position.clone().addScaledVector(d,n/len),near=Math.min(distance(),Math.hypot(next.x-golferGroup.position.x,next.z-golferGroup.position.z))<1.4,target=near?handoffYaw(next):Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(target-actor.rotation.y),Math.cos(target-actor.rotation.y)),yaw=actor.rotation.y+delta*Math.min(1,dt*10);
  if(!clearGround(next)||bodyClearance(next,yaw)<0){if(bodyClearance(actor.position,yaw)>=0)actor.rotation.y=yaw;pathGoal=null;path=[];break;}
  actor.position.copy(next);actor.rotation.y=yaw;remaining-=n;walking=true;diagnostics.walkBackwards=d.dot(V(Math.sin(yaw),0,Math.cos(yaw)))<0;if(n>=len-.001)path.shift();}
 actor.position.y=getTerrainHeight(actor.position.x,actor.position.z);return Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z)<.008;
}
function lookAtAthlete(dt){const yaw=handoffYaw(actor.position),d=Math.atan2(Math.sin(yaw-actor.rotation.y),Math.cos(yaw-actor.rotation.y)),next=actor.rotation.y+d*Math.min(1,dt*12);if(bodyClearance(actor.position,next)>=0)actor.rotation.y=next;}

function localPoint(p){actor.updateMatrixWorld(true);return actor.localToWorld(V(...p));}
function carryPose(){return{p:localPoint([-.19,1.22,.20]),q:actor.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromUnitVectors(Y,V(.04,-.982,.185).normalize()))};}
function bagPose(i,lift=0){const p=worldPose(slots[i]);p.p.add(V(0,lift,0));return p;}
function blendPose(a,b,t){return{p:a.p.clone().lerp(b.p,t),q:a.q.clone().slerp(b.q,t)};}
function clubAt(pose){setWorld(clubs[state.active],pose.p,pose.q);}
function aimBone(b,child,target){const p=b.getWorldPosition(V()),from=child.getWorldPosition(V()).sub(p).normalize(),to=target.clone().sub(p).normalize(),q=new T.Quaternion().setFromUnitVectors(from,to).multiply(b.getWorldQuaternion(new T.Quaternion()));b.quaternion.copy(b.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));b.updateWorldMatrix(false,true);}
function ik(upper,middle,end,target,pole){const p=upper.getWorldPosition(V()),e=middle.getWorldPosition(V()),h=end.getWorldPosition(V()),a=p.distanceTo(e),b=e.distanceTo(h),u=target.clone().sub(p),requested=u.length(),d=clamp(requested,Math.max(.015,Math.abs(a-b)+.005),a+b-.004);u.normalize();let v=pole.clone().addScaledVector(u,-pole.dot(u));if(v.lengthSq()<1e-7)v=V(0,0,1).addScaledVector(u,-u.z);v.normalize();const x=(a*a+d*d-b*b)/(2*d),y=Math.sqrt(Math.max(0,a*a-x*x)),elbow=p.clone().addScaledVector(u,x).addScaledVector(v,y);aimBone(upper,middle,elbow);aimBone(middle,end,p.clone().addScaledVector(u,d));return end.getWorldPosition(V()).distanceTo(target);}
function handTarget(side,target,axis,normal=V(0,0,1)){
 const u=bones['Bip01_'+side+'_UpperArm'],f=bones['Bip01_'+side+'_Forearm'],h=bones['Bip01_'+side+'_Hand'],sign=side==='R'?1:-1,pole=V(sign*.40,-.3,.6).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion()));
 const error=ik(u,f,h,target,pole);if(side==='R')diagnostics.handError=error;else diagnostics.leftHandError=error;
 if(axis){const axes=handAxes[side],forward=axis.clone().normalize(),n=normal.clone().addScaledVector(forward,-normal.dot(forward)).normalize(),right=n.clone().cross(forward).normalize();const worldQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(forward,right,n));h.quaternion.copy(h.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(worldQ).multiply(axes.clone().invert()));h.updateWorldMatrix(false,true);}
 for(let finger=0;finger<5;finger++)for(let j=0;j<3;j++){const name='Bip01_'+side+'_Finger'+finger+(j?j:''),b=bones[name];if(!b)continue;const r=originalRest[name];b.quaternion.copy(r.q).multiply(new T.Quaternion().setFromAxisAngle(V(0,0,1),(side==='R'?-1:1)*(finger===0?.30:j===0?.45:.85)));}
 return error;
}
function settleHandoff(target,dt,crouch){
 const u=bones.Bip01_R_UpperArm,m=bones.Bip01_R_Forearm,h=bones.Bip01_R_Hand,p=u.getWorldPosition(V()),e=m.getWorldPosition(V()),w=h.getWorldPosition(V()),reach=(p.distanceTo(e)+e.distanceTo(w))*.94,dy=target.y-p.y,horizontal=Math.hypot(target.x-p.x,target.z-p.z),allowed=Math.sqrt(Math.max(.001,reach*reach-dy*dy)),need=Math.max(0,horizontal-allowed);
 if(need>.001&&horizontal>.001){const q=actor.position.clone();q.x+=(target.x-p.x)/horizontal*Math.min(need,dt*.55);q.z+=(target.z-p.z)/horizontal*Math.min(need,dt*.55);if(clearGround(q)&&bodyClearance(q,actor.rotation.y)>=0){actor.position.x=q.x;actor.position.z=q.z;actor.position.y=getTerrainHeight(q.x,q.z);animatePerson(0,crouch);}}
}
function animatePerson(dt,crouch=0){
 // PropertyMixer may skip unchanged channels. Restore its last clean animation
 // output before IK; otherwise a planted foot is mistaken for fresh clip lift
 // and gains another crouch offset every idle frame.
 for(const[b,p]of animationPose){b.position.copy(p.p);b.quaternion.copy(p.q);}
 const weight=walking?1:0;walk.enabled=true;idle.enabled=true;walk.setEffectiveWeight(weight);idle.setEffectiveWeight(1-weight);walk.setEffectiveTimeScale((diagnostics.walkBackwards?-1:1)*1.55/1.7);mixer.update(dt);for(const b of Object.values(bones)){let p=animationPose.get(b);if(!p){p={p:b.position.clone(),q:b.quaternion.clone()};animationPose.set(b,p);}else{p.p.copy(b.position);p.q.copy(b.quaternion);}}
 if(document.body.dataset.reducedMotion==='true'||sceneMotionPreference.matches){if(!walking)idle.time=.7;}
 bones.Bip01.position.y=originalRest.Bip01.p.y-crouch*100;actor.updateMatrixWorld(true);
 for(const side of ['L','R']){const foot=bones['Bip01_'+side+'_Foot'],p=foot.getWorldPosition(V()),baseY=actor.position.y+footClearance[side],lift=Math.max(0,p.y-baseY+crouch),target=p.clone();target.y=getTerrainHeight(p.x,p.z)+footClearance[side]+lift;ik(bones['Bip01_'+side+'_Thigh'],bones['Bip01_'+side+'_Calf'],foot,target,V(0,-.1,.7).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())));}
 // The carrying hand holds the real padded shoulder strap, not empty air.
 updateStrap();handTarget('L',model.getObjectByName('StrapGrip').getWorldPosition(V()),null);
 actor.updateMatrixWorld(true);
}
// A real padded ribbon, anchored to the measured shirt surface at the right
// clavicle and to both existing bag fittings. It deforms with the skeleton.
function setupStrap(){
 model.getObjectByName('PaddedShoulderStrap').visible=false;
 const shoulder=bones.Bip01_R_UpperArm,parent=shoulder.parent,center=shoulder.getWorldPosition(V()),seen=new Set();let top=null,surfaceVertex=null;
 model.updateMatrixWorld(true);model.traverse(o=>{if(!o.isSkinnedMesh)return;const a=o.geometry.attributes.position;if(seen.has(a))return;seen.add(a);o.skeleton.update();for(let i=0;i<a.count;i++){const v=V().fromBufferAttribute(a,i);o.boneTransform(i,v);v.applyMatrix4(o.matrixWorld);if(Math.hypot(v.x-center.x,v.z-center.z)<.065&&v.y>center.y-.04&&v.y<center.y+.12&&(!top||v.y>top.y)){top=v;surfaceVertex={mesh:o,index:i};}}});
 top=top||center.clone().add(V(0,.045,0));strapAnchor={parent,local:parent.worldToLocal(top.clone()),surfaceVertex};diagnostics.shoulderSurfaceLocal=actor.worldToLocal(top.clone()).toArray();
 const count=48,pos=new Float32Array((count+1)*4*3),indices=[];for(let i=0;i<count;i++)for(let j=0;j<4;j++){const a=i*4+j,b=i*4+(j+1)%4,c=(i+1)*4+j,d=(i+1)*4+(j+1)%4;indices.push(a,c,b,b,c,d);}
 strapGeometry=new T.BufferGeometry();strapGeometry.setAttribute('position',new T.BufferAttribute(pos,3).setUsage(T.DynamicDrawUsage));strapGeometry.setIndex(indices);strapMesh=new T.Mesh(strapGeometry,new T.MeshStandardMaterial({color:0xe7e2d4,roughness:.86,metalness:0,side:T.DoubleSide}));strapMesh.name='ShoulderFittedPaddedStrap';strapMesh.frustumCulled=false;strapMesh.castShadow=true;strapMesh.receiveShadow=true;actor.add(strapMesh);updateStrap();
}
function updateStrap(){
 if(!strapGeometry)return;actor.updateMatrixWorld(true);const bag=model.getObjectByName('CaddieGolfBag'),q=actor.getWorldQuaternion(new T.Quaternion()),offset=(x,y,z)=>V(x,y,z).applyQuaternion(q),surface=strapAnchor.surfaceVertex?(()=>{const{mesh,index}=strapAnchor.surfaceVertex;mesh.skeleton.update();const p=V().fromBufferAttribute(mesh.geometry.attributes.position,index);mesh.boneTransform(index,p);return p.applyMatrix4(mesh.matrixWorld)})():strapAnchor.parent.localToWorld(strapAnchor.local.clone()),top=surface.clone().add(offset(0,.007,0)),back=top.clone().add(offset(0,-.025,-.065)),front=top.clone().add(offset(0,-.028,.075)),chest=top.clone().add(offset(.018,-.14,.15)),a=bag.localToWorld(V(.04,.70,.01)),b=bag.localToWorld(V(.17,.47,.19));
 const curve=new T.CatmullRomCurve3([a,back,top,front,chest,b],false,'centripetal'),attribute=strapGeometry.attributes.position;for(let i=0;i<=48;i++){const t=i/48,p=curve.getPoint(t),dir=curve.getTangent(t).normalize(),side=offset(1,0,0);side.addScaledVector(dir,-side.dot(dir)).normalize();const normal=side.clone().cross(dir).normalize(),pad=smooth((t-.18)/.10)*(1-smooth((t-.64)/.12)),width=.045+.025*pad,thick=.004+.005*pad;for(let j=0;j<4;j++){const w=j<2?-1:1,h=j===0||j===3?-1:1,v=p.clone().addScaledVector(side,w*width/2).addScaledVector(normal,h*thick/2);actor.worldToLocal(v);attribute.setXYZ(i*4+j,v.x,v.y,v.z);}}
 attribute.needsUpdate=true;strapGeometry.computeVertexNormals();const grip=model.getObjectByName('StrapGrip');grip.position.copy(grip.parent.worldToLocal(curve.getPoint(.72)));grip.updateMatrixWorld(true);diagnostics.strap={shoulder:surface.toArray(),pad:top.toArray(),surfaceOffset:top.distanceTo(surface),bagStart:a.toArray(),bagEnd:b.toArray()};
}

function poseGolfer(dt){
 const a=proGolferAnimator;if(!state.initialized||!a)return;
 if(state.struck&&golferSwingPhase==='fade'){
  if(!finishPose){finishPose=new Map();a.model.traverse(o=>{if(o.isBone)finishPose.set(o,{p:o.position.clone(),q:o.quaternion.clone()});});}
  state.lowerTime+=dt;const t=smooth(state.lowerTime/.9);a.pose(activeSwingStyle,'idle',0);addressObstacles=bodyObstacles();for(const[o,p]of finishPose){const q=o.quaternion.clone(),v=o.position.clone();o.position.copy(p.p).lerp(v,t);o.quaternion.copy(p.q).slerp(q,t);}a.model.updateMatrixWorld(true);
 }
 // Receive/return at a natural hand height, not by forcing the caddie into
 // the golfer's address silhouette. Lower back to the exact calibrated address
 // while she retires; no swing/impact path is changed.
 const exchanging=['return-approach','take','deliver-approach','give'].includes(state.phase),targetLift=exchanging?1:0;handoffLift+=clamp(targetLift-handoffLift,-dt/.55,dt/.55);
 if(handoffLift>0){const p=a.grip.getWorldPosition(V()),lift=clamp(1.08-(p.y-golferGroup.position.y),.08,.40)*smooth(handoffLift);const offer=p.clone().sub(a.bones.Hips.getWorldPosition(V())).setY(0);if(offer.lengthSq()<1e-6)offer.set(aimDirection.z,0,-aimDirection.x);p.addScaledVector(offer.normalize(),.16*smooth(handoffLift));p.y+=lift;a.grip.position.copy(a.grip.parent.worldToLocal(p));a.model.updateMatrixWorld(true);a.gripHands();const q=a.model.getWorldQuaternion(new T.Quaternion());for(const[side,sign]of[['L',1],['R',-1]]){a.arm(side,a.handTargets[side],V(sign*.40,-.45,-.22).applyQuaternion(q));a.fingers(side);}a.model.updateMatrixWorld(true);}
 if(state.held===null&&(golferSwingPhase==='idle'||state.struck)){
  poseRelease=Math.min(1,poseRelease+dt*3);const reach=state.phase==='give'?smooth(state.time/.9):0;
  const relaxed=poseRelease*(1-reach);for(const n of ['Spine','Chest','Neck','Head']){const b=a.bones[n];b.quaternion.slerp(a.rest[b.uuid].q,relaxed);}a.model.updateMatrixWorld(true);
  for(const side of ['L','R']){const upper=a.bones['UpperArm.'+side],fore=a.bones['Forearm.'+side],hand=a.bones['Hand.'+side],uq=upper.quaternion.clone(),fq=fore.quaternion.clone(),hq=hand.quaternion.clone(),sign=side==='L'?1:-1,shoulder=upper.getWorldPosition(V()),target=shoulder.clone().add(V(sign*.07,-.46,.08).applyQuaternion(a.model.getWorldQuaternion(new T.Quaternion())));ik(upper,fore,hand,target,V(sign*.3,-.3,.5).applyQuaternion(a.model.getWorldQuaternion(new T.Quaternion())));const t=side==='R'?reach:state.phase==='give'?smooth((state.time-.65)/.25):0;upper.quaternion.slerp(uq,1-poseRelease+t*poseRelease);fore.quaternion.slerp(fq,1-poseRelease+t*poseRelease);hand.quaternion.copy(hq);for(let f=1;f<=5;f++)for(let j=1;j<=3;j++){const b=a.bones['Finger'+f+'_'+j+'.'+side];if(b)b.quaternion.slerp(a.rest[b.uuid].q,1-t);}}
  a.model.updateMatrixWorld(true);
 }
}
function initialize(){
 if(state.initialized||!state.loaded||!proGolferAnimator)return;const a=proGolferAnimator,chosen=currentClubIndex;
 slots=GOLF_BAG.map((_,i)=>model.getObjectByName('ClubSlot_'+i));if(slots.some(x=>!x))throw Error('Caddie bag club sockets missing');
 for(let i=0;i<GOLF_BAG.length;i++){a.setClub(GOLF_BAG[i]);clubs[i]=a.clubObject;clubs[i].userData.equipmentClubIndex=i;putInBag(i);}a.setClub(GOLF_BAG[chosen]);
 actor.updateMatrixWorld(true);model.traverse(o=>{if(o.isBone){bones[o.name]=o;originalRest[o.name]={q:o.quaternion.clone(),p:o.position.clone()};}if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=true;}});
 bones.Bip01=model.getObjectByName('Bip01');originalRest.Bip01={p:bones.Bip01.position.clone(),q:bones.Bip01.quaternion.clone()};
 for(const side of ['L','R']){const h=bones['Bip01_'+side+'_Hand'],mid=bones['Bip01_'+side+'_Finger2'],index=bones['Bip01_'+side+'_Finger1'],little=bones['Bip01_'+side+'_Finger4'],f=mid.position.clone().normalize(),right=index.position.clone().sub(little.position).normalize(),n=f.clone().cross(right).normalize();right.copy(n).cross(f).normalize();handAxes[side]=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f,right,n));footClearance[side]=Math.max(.045,bones['Bip01_'+side+'_Foot'].getWorldPosition(V()).y);}
 setupStrap();state.initialized=true;reset();if(savedEquipment)restore(savedEquipment);window.PuttUI?.updateShotState(true);event('initialized-13-physical-clubs');
}
function reset(){if(!state.initialized)return;for(let i=0;i<clubs.length;i++)putInBag(i);Object.assign(state,{held:null,active:null,pending:null,purpose:null,struck:false,lowerTime:0});finishPose=null;restCallback=null;handoffLift=0;handoffGoal=null;egressPoint=null;approachStaged=false;path=[];pathGoal=null;poseRelease=1;holeKey=(window.activeCourseId||'mis')+':'+currentHoleNumber;lastBall.copy(ballPos);actor.position.copy(safePlace());actor.rotation.y=Math.atan2(golferGroup.position.x-actor.position.x,golferGroup.position.z-actor.position.z);phase('empty');syncClubs();}
function atBall(){if(!state.initialized)return;const key=(window.activeCourseId||'mis')+':'+currentHoleNumber;if(key!==holeKey){reset();return;}if(lastBall.distanceTo(ballPos)>.4&&!isBallFlying&&golferSwingPhase==='idle'){lastBall.copy(ballPos);actor.position.copy(safePlace());path=[];pathGoal=null;if(state.phase==='retire-empty')phase('empty');}}
function request(index){
 if(!state.initialized||busy()||isBallFlying||golferSwingPhase!=='idle'||!Number.isInteger(index)||index<0||index>=clubs.length)return false;
 state.pending=index;state.purpose='delivery';state.struck=false;state.lowerTime=0;finishPose=null;pathGoal=null;
 if(state.held!==null){state.active=state.held;phase('return-approach');}else{state.active=index;phase('retrieve');}
 return true;
}
function onShot(){if(!canStrike())return false;state.struck=true;state.lowerTime=0;finishPose=null;state.active=state.held;phase('shot');return true;}
function finishInterruptedShot(){if(!state.initialized||state.held===null||state.phase!=='shot')return;state.purpose='post-shot';state.pending=null;state.active=state.held;state.struck=true;state.lowerTime=.9;finishPose=null;proGolferAnimator.pose(activeSwingStyle,'idle',0);pathGoal=null;phase('return-approach');}
function deferRest(callback){if(!state.initialized||(!state.struck&&state.held===null))return false;if(state.struck||state.held!==null){restCallback=callback;return true;}return false;}
function finishStored(){
 putInBag(state.active);state.held=null;
 if(state.purpose==='delivery'&&state.pending!==null){state.active=state.pending;positionGolferAtBall();phase('retrieve');}
 else{state.struck=false;state.active=null;state.pending=null;phase('retire-empty');const callback=restCallback;restCallback=null;if(callback)callback();window.PuttUI?.saveSession();}
}
function busy(){return !state.initialized||!['empty','ready','follow','shot','retire-empty'].includes(state.phase);}
function canStrike(){const d=actor.position.clone().sub(ballPos),inShot=d.dot(aimDirection)>0&&Math.abs(d.x*aimDirection.z-d.z*aimDirection.x)<3;return !inShot&&state.initialized&&state.phase==='ready'&&state.held===currentClubIndex&&owners[currentClubIndex]==='golfer'&&distance()>=4;}
function restore(data){savedEquipment=data;if(!state.initialized)return;reset();if(data?.schema===1&&Number.isInteger(data.heldClub)&&data.heldClub===currentClubIndex&&data.heldClub>=0&&data.heldClub<clubs.length){giveGolfer(data.heldClub);state.active=data.heldClub;phase('ready');}savedEquipment=null;syncClubs();}
function tick(dt){
 initialize();if(!state.initialized)return;atBall();if(window.GreenReader?.enabled){syncClubs();return;}
 actor.visible=document.body.dataset.view==='game'&&(!isCameraTransitioning||isBallFlying);if(document.body.dataset.view!=='game')return;
 state.time+=dt;walking=false;addressObstacles=bodyObstacles();poseGolfer(dt);currentObstacles=bodyObstacles();const name=state.phase;let crouch=0;
 if(name==='empty'||name==='ready'||name==='follow'||name==='retire-empty'){
  const delta=actor.position.clone().sub(golferGroup.position),forward=delta.dot(aimDirection),cross=Math.abs(delta.x*aimDirection.z-delta.z*aimDirection.x);
  if(distance()<4.05||(forward>0&&cross<3)||name==='retire-empty'||name==='follow'){
   const exiting=name==='retire-empty'&&egressPoint;const goal=exiting?egressPoint:(pathGoal||safePlace());if(move(goal,dt)){pathGoal=null;if(exiting){egressPoint=null;}else{phase(state.held===null?'empty':'ready');window.PuttUI?.saveSession();}}else if(name!=='retire-empty')phase('follow');
  }else lookAtAthlete(dt);
 }else if(name==='shot'){
  lookAtAthlete(dt);if(golferSwingPhase==='fade'){state.purpose='post-shot';state.pending=null;state.active=state.held;pathGoal=null;phase('return-approach');}
 }else if(name==='return-approach'||name==='deliver-approach'){
  const reference=proGolferAnimator.grip.getWorldPosition(V());if(!handoffGoal||!clearGround(handoffGoal)||!handoffGripReference||Math.hypot(reference.x-handoffGripReference.x,reference.z-handoffGripReference.z)>.04){handoffGoal=handoffPlace();handoffGripReference=reference;approachStaged=false;pathGoal=null;}const goal=handoffGoal;if(goal){const grip=proGolferAnimator.grip.getWorldPosition(V()),away=goal.clone().sub(grip).setY(0).normalize(),stage=goal.clone().addScaledVector(away,.90);stage.y=getTerrainHeight(stage.x,stage.z);egressPoint=stage.clone();if(!approachStaged){if(move(stage,dt)){approachStaged=true;pathGoal=null;}}else if(move(goal,dt)){pathGoal=null;phase(name==='return-approach'?'take':'give');}}if(name==='deliver-approach')clubAt(carryPose());
 }else if(name==='take'){
  lookAtAthlete(dt);crouch=clamp(1.38-(proGolferAnimator.grip.getWorldPosition(V()).y-actor.position.y+.29),.10,.34)*smooth(state.time/.55);if(state.time>=.85&&diagnostics.handError<.02){takeCarrier(state.held);state.held=null;poseRelease=0;phase('receive');}
 }else if(name==='receive'){
  lookAtAthlete(dt);crouch=.18*(1-smooth(state.time/.8));if(!stageStart)stageStart=worldPose(clubs[state.active]);clubAt(blendPose(stageStart,carryPose(),smooth(state.time/.8)));grasp=.07;if(state.time>=.8)phase('stow-prepare');
 }else if(name==='retrieve'){
  lookAtAthlete(dt);crouch=.12*smooth(state.time/.35);grasp=.79;if(state.time>.5&&diagnostics.handError<.02){takeCarrier(state.active);phase('extract');}
 }else if(name==='extract'){
  lookAtAthlete(dt);crouch=.12*(1-smooth((state.time-.3)/.65));const start=bagPose(state.active),end=bagPose(state.active,.87);clubAt(blendPose(start,end,smooth((state.time-.3)/1.05)));grasp=T.MathUtils.lerp(.79,.49,smooth((state.time-.3)/1.05));if(state.time>=1.35)phase('prepare');
 }else if(name==='prepare'||name==='stow-prepare'){
  lookAtAthlete(dt);if(!stageStart)stageStart=worldPose(clubs[state.active]);const t=smooth(state.time/1.15),target=name==='prepare'?carryPose():bagPose(state.active,.87);clubAt(blendPose(stageStart,target,t));grasp=name==='prepare'?T.MathUtils.lerp(.49,.07,t):T.MathUtils.lerp(.07,.49,t);if(state.time>=1.15)phase(name==='prepare'?'deliver-approach':'insert');
 }else if(name==='insert'){
  lookAtAthlete(dt);clubAt(blendPose(bagPose(state.active,.87),bagPose(state.active),smooth(state.time/1.05)));grasp=T.MathUtils.lerp(.49,.79,smooth(state.time/1.05));if(state.time>=1.05)finishStored();
 }else if(name==='give'){
  lookAtAthlete(dt);crouch=clamp(1.38-(proGolferAnimator.grip.getWorldPosition(V()).y-actor.position.y+.29),.10,.34)*smooth(state.time/.55);if(!stageStart)stageStart=worldPose(clubs[state.active]);const target=worldPose(proGolferAnimator.grip);clubAt(blendPose(stageStart,target,smooth(state.time/.9)));grasp=0;if(state.time>=.95&&diagnostics.handError<.02){giveGolfer(state.active);state.pending=null;state.purpose=null;pathGoal=null;phase('retire-equipped');}
 }else if(name==='retire-equipped'){
  const exiting=!!egressPoint,goal=egressPoint||(pathGoal||safePlace());if(move(goal,dt)){pathGoal=null;if(exiting)egressPoint=null;else{phase('ready');window.PuttUI?.saveSession();}}
 }
 animatePerson(dt,crouch);
 if(state.phase==='give'||state.phase==='take'){const i=state.phase==='give'?state.active:state.held;if(i!==null)settleHandoff(clubs[i].localToWorld(V(0,0,0)),dt,crouch);}
 if(state.active!==null&&owners[state.active]==='caddie'){
  const club=clubs[state.active],target=club.localToWorld(V(0,grasp,0)),axis=Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ));handTarget('R',target,axis,V(0,0,1).applyQuaternion(actor.getWorldQuaternion(tempQ)));
  if(state.phase==='prepare'||state.phase==='stow-prepare'){const u=bones.Bip01_L_UpperArm,m=bones.Bip01_L_Forearm,h=bones.Bip01_L_Hand,p=u.getWorldPosition(V()),e=m.getWorldPosition(V()),w=h.getWorldPosition(V()),root=club.getWorldPosition(V()),at=clamp(p.clone().sub(root).dot(axis),.12,.65),support=club.localToWorld(V(0,at,0));if(p.distanceTo(support)<(p.distanceTo(e)+e.distanceTo(w))*.94)handTarget('L',support,axis);}
 }else if(state.phase==='retrieve'){handTarget('R',clubs[state.active].localToWorld(V(0,.79,0)),Y.clone().applyQuaternion(clubs[state.active].getWorldQuaternion(tempQ)));
 }else if(state.phase==='take'&&state.held!==null){const club=clubs[state.held];handTarget('R',club.localToWorld(V(0,0,0)),Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ)));}
 updateStrap();if(!['prepare','stow-prepare'].includes(state.phase))handTarget('L',model.getObjectByName('StrapGrip').getWorldPosition(V()),null);syncClubs();actor.updateMatrixWorld(true);diagnostics.feet=['L','R'].map(side=>{const p=bones['Bip01_'+side+'_Foot'].getWorldPosition(V());return{side,height:p.y-getTerrainHeight(p.x,p.z)}});diagnostics.bodyClearance=bodyClearance(actor.position,actor.rotation.y);diagnostics.phase=state.phase;diagnostics.owners=[...owners];diagnostics.safeDistance=distance();diagnostics.ready=canStrike();diagnostics.finite=actor.position.toArray().every(Number.isFinite)&&clubs.every(o=>o.position.toArray().every(Number.isFinite));
}
const api={actor,diagnostics,request,onShot,finishInterruptedShot,tick,reset,atBall,deferRest,restore,exportState:()=>({schema:1,heldClub:state.phase==='ready'?state.held:null}),get loaded(){return state.loaded;},get initialized(){return state.initialized;},get busy(){return busy();},get canStrike(){return canStrike();},get phase(){return state.phase;},get heldClub(){return state.held===null?null:GOLF_BAG[state.held];},get empty(){return state.held===null;},get state(){return{...state,owners:[...owners]};}};window.CaddieSystem=api;
window.CaddieReady=new T.GLTFLoader().loadAsync('./characters/caddie.glb').then(gltf=>{model=gltf.scene;actor.add(model);mixer=new T.AnimationMixer(model);idle=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Idle'));walk=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Walk'));idle.play();walk.play();state.loaded=true;return true;});
})();
