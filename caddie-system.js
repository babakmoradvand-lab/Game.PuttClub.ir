/* Caddie36 — real skinned human, one physical instance of each calibrated club.
 * Human base and source Walk/Idle: Microsoft Rocketbox, MIT (see characters/LICENSE.txt).
 * Equipment FSM is separate from GolfMotion and the shot integrator. */
(() => {
'use strict';
const T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0),clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const actor=new T.Group();actor.name='PuttClubHumanCaddie';actor.visible=false;scene.add(actor);
const carrier=new T.Group();carrier.name='ActualClubInExchange';scene.add(carrier);
const state={loaded:false,initialized:false,phase:'loading',time:0,held:null,active:null,purpose:null,pending:null,struck:false,lowerTime:0,holeDone:false};
const diagnostics={version:'caddie36',source:'Microsoft Rocketbox Female_Adult_01 / MIT',events:[],transfers:0,handError:0,finite:true,pathFailures:0};
let model,mixer,idle,walk,bones={},slots=[],clubs=[],owners=[],path=[],pathGoal=null,restCallback=null,savedEquipment=null,finishPose=null,poseRelease=1,lastBall=V(Infinity,0,0),holeKey='',stageStart=null,stageEnd=null,grasp=.07,walking=false,navRetry=0;
let addressStart=null,offerStart=null,offerTime=0,studyBlend=0,caddyLean=0,maleLean=0,releaseStart=null,releaseTime=0;
const MOVE_SPEED=2.65,BODY_CLEARANCE=.90,PARK_CLEARANCE=3.20;
const originalRest={},footClearance={},handAxes={},tempQ=new T.Quaternion();
function event(name,index=state.active){diagnostics.events.push({event:name,club:index,phase:state.phase,stroke:strokesCurrentHole});if(diagnostics.events.length>160)diagnostics.events.shift();}
function phase(name){state.phase=name;state.time=0;stageStart=null;stageEnd=null;if(name==='retire-equipped')addressStart=null;event(name);window.PuttUI?.updateShotState(true);if(['ready','empty'].includes(name)&&canAdjustAim())updateAimTracer();}
function worldPose(o){o.updateWorldMatrix(true,false);return{p:o.getWorldPosition(V()),q:o.getWorldQuaternion(new T.Quaternion())};}
function setWorld(o,p,q){o.parent.updateWorldMatrix(true,false);o.position.copy(o.parent.worldToLocal(p.clone()));o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));o.scale.set(1,1,1);o.updateMatrixWorld(true);}
function putInBag(i){const o=clubs[i];slots[i].add(o);o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);owners[i]='bag';o.visible=true;event('stored-in-bag',i);}
function takeCarrier(i){const pose=worldPose(clubs[i]);carrier.add(clubs[i]);setWorld(clubs[i],pose.p,pose.q);owners[i]='caddie';state.active=i;diagnostics.transfers++;event('caddie-took-physical-club',i);}
function giveGolfer(i){const a=proGolferAnimator;a.grip.add(clubs[i]);clubs[i].position.set(0,0,0);clubs[i].quaternion.identity();clubs[i].scale.set(1,1,1);owners[i]='golfer';state.held=i;poseRelease=0;a.setClub(GOLF_BAG[i]);diagnostics.transfers++;event('delivered-to-golfer',i);}
function syncClubs(){if(!state.initialized)return;for(let i=0;i<clubs.length;i++)clubs[i].visible=true;}
function distance(){return Math.hypot(actor.position.x-golferGroup.position.x,actor.position.z-golferGroup.position.z);}
function clearGround(p,park=false){
 if(Math.hypot(p.x-golferGroup.position.x,p.z-golferGroup.position.z)<BODY_CLEARANCE)return false;
 if(!isPuttClub())return true;const pc=window.PuttClubCourse;
 for(const[x,z]of [[0,0],[.24,0],[-.24,0],[0,.24],[0,-.24]])if(pc.areaAt(V(p.x+x,0,p.z+z)))return false;
 if(park&&pc.surface(p.x,p.z).type==='bunker')return false;
 for(const i of pc.treeCandidates(p,p)){const t=pc.trees.instances[i];if(Math.hypot(t.position[0]-p.x,t.position[2]-p.z)<.68)return false;}
 return true;
}
// A wider wood stance can put the old parking point below a tee ledge.
// Prefer the same walkable elevation; keep the original actor, gait and FSM.
function safePlace(){const side=V(aimDirection.z,0,-aimDirection.x),base=golferGroup.position;
 const candidates=[[3.4,-1.2],[-3.4,-1.2],[3.0,-2.0],[-3.0,-2.0],[0,-3.6],[3.6,0],[-3.6,0],[3.4,2],[-3.4,2]];
 for(const[x,z]of candidates){const p=base.clone().addScaledVector(side,x).addScaledVector(aimDirection,z);if(clearGround(p,true)&&Math.abs(getTerrainHeight(p.x,p.z)-getTerrainHeight(base.x,base.z))<.55){p.y=getTerrainHeight(p.x,p.z);return p;}}
 for(const r of [3,2.4,1.8,5,6,7,8,9,10,11,12])for(let k=0;k<16;k++){const p=base.clone().add(V(Math.sin(k*Math.PI/8)*r,0,Math.cos(k*Math.PI/8)*r));if(clearGround(p,true)&&Math.abs(getTerrainHeight(p.x,p.z)-getTerrainHeight(base.x,base.z))<.55){p.y=getTerrainHeight(p.x,p.z);return p;}}
 return base.clone().addScaledVector(side,4.5);
}
function handoffPlace(staging=false){
 const base=golferGroup.position,away=actor.position.clone().sub(base).setY(0).normalize();if(away.lengthSq()<.5)away.set(aimDirection.z,0,-aimDirection.x);
 const radius=staging?2.25:.94;
 for(const r of [radius,radius+.12,radius+.24])for(const angle of [0,.28,-.28,.55,-.55,.9,-.9,1.4,-1.4,Math.PI]){
  const q=base.clone().addScaledVector(away.clone().applyAxisAngle(Y,angle),r);q.y=getTerrainHeight(q.x,q.z);
  if(clearGround(q)&&Math.abs(q.y-base.y)<.35)return q;
 }
 return safePlace();
}

function plan(goal){
 pathGoal=goal.clone();const start=actor.position.clone(),segment=(a,b)=>{const n=Math.ceil(a.distanceTo(b)/.22);for(let i=1;i<=n;i++){const p=a.clone().lerp(b,i/n);if(!clearGround(p)||Math.abs(getTerrainHeight(p.x,p.z)-getTerrainHeight(a.x,a.z))>Math.max(.6,a.distanceTo(p)*.65))return false;}return true;};
 if(segment(start,goal)){path=[goal.clone()];return true;}
 // Small local A*: navigation for this person only; never a shot/path planner.
 const step=.5,origin=start.clone().add(V(-10,0,-10)),size=41,key=(x,z)=>z*size+x,pos=(x,z)=>V(origin.x+x*step,0,origin.z+z*step),sx=20,sz=20,gx=clamp(Math.round((goal.x-origin.x)/step),0,40),gz=clamp(Math.round((goal.z-origin.z)/step),0,40),open=[{x:sx,z:sz,g:0,f:0}],best=new Map([[key(sx,sz),0]]),came=new Map();let end=null;
 for(let tries=0;open.length&&tries<1600;tries++){open.sort((a,b)=>a.f-b.f);const n=open.shift(),id=key(n.x,n.z);if(n.x===gx&&n.z===gz){end=id;break;}for(const[dx,dz]of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]]){const x=n.x+dx,z=n.z+dz;if(x<0||z<0||x>=size||z>=size)continue;const q=pos(x,z),prev=pos(n.x,n.z);if(!clearGround(q)||!segment(prev,q))continue;const g=n.g+Math.hypot(dx,dz),k=key(x,z);if(g>=(best.get(k)??Infinity))continue;best.set(k,g);came.set(k,id);open.push({x,z,g,f:g+Math.hypot(gx-x,gz-z)});}}
 if(end!==null){const out=[goal.clone()];for(let id=end;id!==key(sx,sz);id=came.get(id)){if(id===undefined)break;out.push(pos(id%size,Math.floor(id/size)));}path=out.reverse();return true;}
 diagnostics.pathFailures++;event('no-safe-path');path=[];return false;
}
function move(goal,dt){navRetry=Math.max(0,navRetry-dt);const gap=Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z);if(!pathGoal||pathGoal.distanceTo(goal)>.30||(!path.length&&gap>=.008&&navRetry===0)){navRetry=plan(goal)?0:.75;}let remaining=dt*MOVE_SPEED;walking=false;
 while(path.length&&remaining>0){const q=path[0],d=V(q.x-actor.position.x,0,q.z-actor.position.z),len=d.length();if(len<.005){actor.position.x=q.x;actor.position.z=q.z;path.shift();continue;}const n=Math.min(len,remaining),candidate=actor.position.clone().addScaledVector(d,n/len);if(Math.hypot(candidate.x-golferGroup.position.x,candidate.z-golferGroup.position.z)<BODY_CLEARANCE){path=[];pathGoal=null;navRetry=0;break;}actor.position.addScaledVector(d,n/len);remaining-=n;walking=true;const target=Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(target-actor.rotation.y),Math.cos(target-actor.rotation.y));actor.rotation.y+=delta*Math.min(1,dt*10);if(n>=len-.001)path.shift();}
 actor.position.y=getTerrainHeight(actor.position.x,actor.position.z);return Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z)<.008;
}
function lookAtAthlete(dt){const p=golferGroup.position.clone().add(V(0,1.3,0)),yaw=Math.atan2(p.x-actor.position.x,p.z-actor.position.z),d=Math.atan2(Math.sin(yaw-actor.rotation.y),Math.cos(yaw-actor.rotation.y));actor.rotation.y+=d*Math.min(1,dt*12);}
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
 diagnostics.bodyRootGap=distance();
 if(distance()<BODY_CLEARANCE-.001){
  const d=actor.position.clone().sub(golferGroup.position).setY(0);if(d.lengthSq()<1e-6)d.set(aimDirection.z,0,-aimDirection.x);
  actor.position.copy(golferGroup.position).addScaledVector(d.normalize(),BODY_CLEARANCE+.015);actor.position.y=getTerrainHeight(actor.position.x,actor.position.z);actor.updateMatrixWorld(true);
 }
}

function animatePerson(dt,crouch=0){
 for(const[name,rest]of Object.entries(originalRest)){const b=bones[name];if(b){b.position.copy(rest.p);b.quaternion.copy(rest.q);}}
 const weight=walking?1:0;walk.enabled=true;idle.enabled=true;walk.setEffectiveWeight(weight);idle.setEffectiveWeight(1-weight);walk.setEffectiveTimeScale(MOVE_SPEED/1.7);mixer.update(dt);
 if(document.body.dataset.reducedMotion==='true'||sceneMotionPreference.matches){if(!walking)idle.time=.7;}
 bones.Bip01.position.y=originalRest.Bip01.p.y-crouch*100;actor.updateMatrixWorld(true);
 const exchanging=['give','take','deliver-approach','return-approach'].includes(state.phase),leanTarget=exchanging?smooth((1.65-distance())/.65)*.14:0;caddyLean+=(leanTarget-caddyLean)*(1-Math.exp(-dt*12));
 const spine=bones.Bip01_Spine,front=golferGroup.position.clone().sub(actor.position).setY(0).normalize(),axis=Y.clone().cross(front),q=new T.Quaternion().setFromAxisAngle(axis,caddyLean).multiply(spine.getWorldQuaternion(new T.Quaternion()));spine.quaternion.copy(spine.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));actor.updateMatrixWorld(true);
 for(const side of ['L','R']){const foot=bones['Bip01_'+side+'_Foot'],p=foot.getWorldPosition(V()),baseY=actor.position.y+footClearance[side],lift=Math.max(0,p.y-baseY+crouch),target=p.clone();target.y=getTerrainHeight(p.x,p.z)+footClearance[side]+lift;ik(bones['Bip01_'+side+'_Thigh'],bones['Bip01_'+side+'_Calf'],foot,target,V(0,-.1,.7).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())));}
 // The carrying hand holds the real padded shoulder strap, not empty air.
 handTarget('L',model.getObjectByName('StrapGrip').getWorldPosition(V()),null);
 actor.updateMatrixWorld(true);
}
function saveBones(a){const m=new Map();a.model.traverse(o=>{if(o.isBone)m.set(o,{p:o.position.clone(),q:o.quaternion.clone(),s:o.scale.clone()});});return m;}
function blendBones(start,t){for(const[o,r]of start){o.position.lerpVectors(r.p,o.position,t);o.quaternion.copy(r.q.clone().slerp(o.quaternion,t));o.scale.lerpVectors(r.s,o.scale,t);}}
function resetHuman(a){a.model.traverse(o=>{const r=a.rest[o.uuid];if(r){o.position.copy(r.p);o.quaternion.copy(r.q);o.scale.copy(r.s);}});a.model.updateMatrixWorld(true);}
function turnHuman(target,dt,rate=9){const yaw=Math.atan2(target.x-golferGroup.position.x,target.z-golferGroup.position.z),d=Math.atan2(Math.sin(yaw-golferGroup.rotation.y),Math.cos(yaw-golferGroup.rotation.y));golferGroup.rotation.y+=d*(1-Math.exp(-rate*dt));golferGroup.updateMatrixWorld(true);}
function fitHumanFeet(a,width=.32){
 const q=a.model.getWorldQuaternion(new T.Quaternion());
 for(const[side,sign]of [['L',1],['R',-1]]){const ft=a.footTarget(side,width,0,0);a.ik('Thigh.'+side,'Shin.'+side,ft.position,V(sign*.12,-.05,1).applyQuaternion(q),a.restLengths['leg'+side]);a.rotateWorld(a.bones['Foot.'+side],ft.rotation);}
}
function maleHand(a,side,target,q,curl=false){
 a.handRotations=a.handRotations||{};a.handRotations[side]=q;a._armState=a._armState||{};delete a._armState[side];
 const sign=side==='L'?1:-1;a.arm(side,target,V(sign*.45,-.32,.6).applyQuaternion(a.model.getWorldQuaternion(new T.Quaternion())));
 if(curl)a.fingers(side);else for(let f=1;f<=5;f++)for(let j=1;j<=3;j++){const b=a.bones['Finger'+f+'_'+j+'.'+side];if(b)b.quaternion.copy(a.rest[b.uuid].q);}
}
function relaxArms(a){
 const q=a.model.getWorldQuaternion(new T.Quaternion());
 for(const[side,sign]of [['L',1],['R',-1]]){const hand=a.bones['Hand.'+side],shoulder=a.bones['UpperArm.'+side].getWorldPosition(V()),target=shoulder.clone().add(V(sign*.075,-.48,.085).applyQuaternion(q));maleHand(a,side,target,q.clone().multiply(a.rest[hand.uuid].worldQ),false);}
}
function exchangePose(a){
 const sm=a.bones['UpperArm.L'].getWorldPosition(V()),sc=bones.Bip01_R_UpperArm.getWorldPosition(V()),dir=actor.position.clone().sub(golferGroup.position).setY(0).normalize(),q=golferGroup.getWorldQuaternion(new T.Quaternion()).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),Math.PI-.09)),axis=Y.clone().applyQuaternion(q);
 const handQ=GolfAthlete.handFrame('L');
 const om=V(0,.025,0).sub((a.isMPFB?V(.01957656,.09546318,-.00045376):V(.010,.090,.026)).applyQuaternion(handQ)).applyQuaternion(q),oc=axis.clone().multiplyScalar(state.held!==null?.16:.14),cm=sm.clone().sub(om),cc=sc.clone().sub(oc),rm=a.restLengths.armL.reduce((x,y)=>x+y,0)-.012;
 const rc=bones.Bip01_R_UpperArm.getWorldPosition(V()).distanceTo(bones.Bip01_R_Forearm.getWorldPosition(V()))+bones.Bip01_R_Forearm.getWorldPosition(V()).distanceTo(bones.Bip01_R_Hand.getWorldPosition(V()))-.012;
 const near=sm.clone().addScaledVector(dir,.30),mid=cm.clone().lerp(cc,rm/(rm+rc)),p=near.lerp(mid,smooth((1.42-distance())/.35));
 p.y-=.12;const minY=Math.max(golferGroup.position.y,actor.position.y)+(clubs[state.active??state.held]?.userData.shaftLength||.95)+.055;
 for(let i=0;i<8;i++){for(const[c,r]of [[cc,rc],[cm,rm]]){const d=p.clone().sub(c),n=d.length();if(n>r)p.copy(c).addScaledVector(d,r/n);}p.y=Math.max(p.y,minY);}
 diagnostics.exchangeReach={male:p.distanceTo(cm),maleMax:rm,caddie:p.distanceTo(cc),caddieMax:rc};return{p,q};
}
function alignMaleGrip(a,t=0,right=0){
 a.gripHands();const shoulder=a.bones['UpperArm.L'].getWorldPosition(V()),d=a.handTargets.L.clone().sub(shoulder),max=a.restLengths.armL.reduce((x,y)=>x+y,0)-.006;
 if(d.length()>max){const correction=shoulder.addScaledVector(d,max/d.length()).sub(a.handTargets.L),pose=worldPose(a.grip);setWorld(a.grip,pose.p.add(correction),pose.q);a.gripHands();}
 maleHand(a,'L',a.handTargets.L,a.handRotations.L,true);diagnostics.golferHandError=a.bones['Hand.L'].getWorldPosition(V()).distanceTo(a.handTargets.L);
 if(right>0){const target=a.bones['Hand.R'].getWorldPosition(V()).lerp(a.handTargets.R,right);maleHand(a,'R',target,a.handRotations.R,right>.55);}
}
function lookHuman(a,target){
 const head=a.bones.Head,p=head.getWorldPosition(V()),d=target.clone().sub(p).applyQuaternion(a.model.getWorldQuaternion(new T.Quaternion()).invert());
 const yaw=Math.atan2(d.x,d.z),pitch=clamp(-Math.atan2(d.y,Math.max(.01,Math.hypot(d.x,d.z))),-.35,.55);
 a.bodyRotation('Head',yaw,pitch);head.updateWorldMatrix(false,true);
}
function studying(a,t){
 const head=a.bones.Head.getWorldPosition(V()),q=a.model.getWorldQuaternion(new T.Quaternion()),target=head.clone().add(V(-.17,.115,.19).applyQuaternion(q));
 const fingersAcross=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(V(0,1,0),V(1,0,0),V(0,0,-1)));
 const at=a.bones['Hand.R'].getWorldPosition(V()).lerp(target,t),hq=a.bones['Hand.R'].getWorldQuaternion(new T.Quaternion()).slerp(q.clone().multiply(fingersAcross),t);
 maleHand(a,'R',at,hq,false);diagnostics.studyWristError=a.bones['Hand.R'].getWorldPosition(V()).distanceTo(target);
}
function controlsPose(){
 if(window.GolferLocomotion?.busy)return true;
 if(!state.initialized)return false;
 if(golferSwingPhase==='backswing'||golferSwingPhase==='downswing'||golferSwingPhase==='followthrough')return false;
 if(golferSwingPhase==='fade'&&golferFinishHold>0)return false;
 return state.phase!=='ready'||state.held===null;
}
function desiredAddressPosition(){
 const club=GOLF_BAG[currentClubIndex],st=GolfAthlete.address(club,club.isPutter?'putt':currentSwingMode),side=V(aimDirection.z,0,-aimDirection.x),p=ballPos.clone().addScaledVector(side,st.distance).addScaledVector(aimDirection,-st.lead);
 p.y=strokesCurrentHole===0?getTerrainHeight(ballPos.x,ballPos.z)+(isPuttClub()?0:.15):getTerrainHeight(p.x,p.z);return p;
}
function poseGolfer(dt){
 if(window.GolferLocomotion?.busy)return;
 if(state.phase==='read-green'){
  const a=proGolferAnimator,t=state.time;if(!readStart)readStart=a.behaviorSnapshot();
  if(t<2.7){a.readGreenPose();if(t<1.0)a.blendRead(readStart,t);if(t>=1)readRise=a.behaviorSnapshot();}
  else{resetGolferPosture();a.blendRead(readRise||readStart,(t-2.7)/.95);}
  diagnostics.pose='read-first-putt';if(t>=3.65){readStart=readRise=null;phase('ready');window.PuttUI?.saveSession();}return;
 }
 if(state.phase==='celebrate'){
  const a=proGolferAnimator;if(!joyStart)joyStart=a.behaviorSnapshot();a.celebratePose();const targetClubQ=a.grip.quaternion.clone();a.behaviorBlend(joyStart,Math.min(1,state.time/.95),false);a.grip.quaternion.copy(joyStart.q.clone().slerp(targetClubQ,GolferBehavior.ease(state.time/.95)));a.model.updateMatrixWorld(true);
  // Keep the real grip in the raised left hand through the blend.
  const h=a.bones['Hand.L'],q=a.grip.getWorldQuaternion(new T.Quaternion()),p=h.localToWorld(V(.01957656,.09546318,-.00045376)).sub(V(0,.025,0).applyQuaternion(q));a.grip.position.copy(a.grip.parent.worldToLocal(p));a.model.updateMatrixWorld(true);for(const mesh of a.skinMeshes)mesh.skeleton.update();
  diagnostics.pose='cup-celebration';if(state.time>=3.8){joyStart=null;document.getElementById('celebration-overlay').style.visibility='';golferSwingPhase='idle';golferSwingProgress=0;golferFinishHold=0;offerStart=null;offerTime=0;pathGoal=null;phase('return-approach');}return;
 }
 const a=proGolferAnimator;if(!state.initialized||!a)return;
 if(golferSwingPhase==='followthrough'||golferSwingPhase==='fade'&&golferFinishHold>0){lookHuman(a,ballPos);diagnostics.pose='watch-finish';return;}
 if(!controlsPose())return;
 const returning=state.held!==null&&(state.struck&&['fade','idle'].includes(golferSwingPhase)||state.purpose==='delivery');
 if(returning&&!offerStart){offerStart={bones:saveBones(a),grip:worldPose(a.grip),rootQ:golferGroup.quaternion.clone()};offerTime=0;}
 if(returning)offerTime+=dt;
 const preparing=state.phase==='retire-equipped',exchanging=returning||['give','take'].includes(state.phase)||(['return-approach','deliver-approach'].includes(state.phase)&&distance()<2.45);
 if(preparing){
  const t=smooth(state.time/.55);if(!addressStart)addressStart={bones:saveBones(a),q:golferGroup.quaternion.clone(),p:golferGroup.position.clone()};
  const yaw=Math.atan2(aimDirection.x,aimDirection.z)-Math.PI/2,targetQ=new T.Quaternion().setFromAxisAngle(Y,yaw);
  golferGroup.quaternion.copy(addressStart.q).slerp(targetQ,t);golferGroup.position.lerpVectors(addressStart.p,desiredAddressPosition(),t);golferGroup.updateMatrixWorld(true);
  a.setContact(a.model.worldToLocal(ballPos.clone()),BALL_RADIUS);a.pose(GOLF_BAG[currentClubIndex].isPutter?'putt':currentSwingMode,'idle',0);blendBones(addressStart.bones,t);a.model.updateMatrixWorld(true);alignMaleGrip(a,t,t);fitHumanFeet(a,THREE.MathUtils.lerp(.32,GolfAthlete.address(GOLF_BAG[currentClubIndex],currentSwingMode).width,t));diagnostics.pose='turn-to-address';
 }else{
  const pin=holePins3D[currentHoleNumber]||golferGroup.position.clone().add(aimDirection),target=exchanging?actor.position:pin;
  turnHuman(target,dt);resetHuman(a);
  const forward=actor.position.clone().sub(golferGroup.position).setY(0).normalize(),leanAxis=Y.clone().cross(forward),spine=a.bones.Spine,spineQ=spine.getWorldQuaternion(new T.Quaternion());let wantedLean=exchanging?smooth((1.65-distance())/.65)*.15:0;
  if(exchanging&&distance()<1.42){for(let angle=.15;angle<=.751;angle+=.10){a.rotateWorld(spine,new T.Quaternion().setFromAxisAngle(leanAxis,angle).multiply(spineQ));exchangePose(a);wantedLean=angle;const r=diagnostics.exchangeReach;if(r.caddie<=r.caddieMax+.003)break;}}
  maleLean+=(wantedLean-maleLean)*(1-Math.exp(-dt*14));a.rotateWorld(spine,new T.Quaternion().setFromAxisAngle(leanAxis,maleLean).multiply(spineQ));diagnostics.maleLean=maleLean;fitHumanFeet(a);relaxArms(a);
  if(exchanging){
   const socket=exchangePose(a);setWorld(a.grip,socket.p,socket.q);
   if(returning&&offerStart&&state.held!==null){
    const t=smooth(offerTime/.55);blendBones(offerStart.bones,t);a.model.updateMatrixWorld(true);
    const root=golferGroup.position,turnQ=golferGroup.quaternion.clone().multiply(offerStart.rootQ.clone().invert()),start=offerStart.grip.p.clone().sub(root).applyQuaternion(turnQ),end=socket.p.clone().sub(root),angle=Math.atan2(start.x,start.z),delta=Math.atan2(Math.sin(Math.atan2(end.x,end.z)-angle),Math.cos(Math.atan2(end.x,end.z)-angle)),radius=Math.max(.53*Math.sin(Math.PI*t),THREE.MathUtils.lerp(Math.hypot(start.x,start.z),Math.hypot(end.x,end.z),t));
    const p=V(root.x+Math.sin(angle+delta*t)*radius,THREE.MathUtils.lerp(offerStart.grip.p.y,socket.p.y,t),root.z+Math.cos(angle+delta*t)*radius);
    setWorld(a.grip,p,turnQ.multiply(offerStart.grip.q).slerp(socket.q,t));fitHumanFeet(a);alignMaleGrip(a,0,1-t);
   }else if(state.held!==null||state.phase==='give')alignMaleGrip(a,0,0);
   lookHuman(a,actor.position.clone().add(V(0,1.55,0)));diagnostics.pose='face-caddie';studyBlend=0;
  }else{
   studyBlend=Math.min(1,studyBlend+dt*3.5);studying(a,smooth(studyBlend));lookHuman(a,isBallFlying?ballPos:pin);diagnostics.pose='study-green';
  }
 }
 if(releaseStart&&state.held===null){releaseTime+=dt;blendBones(releaseStart,smooth(releaseTime/.32));if(releaseTime>=.32)releaseStart=null;fitHumanFeet(a);}
 a.model.updateMatrixWorld(true);for(const mesh of a.skinMeshes)mesh.skeleton.update();
 diagnostics.golferYaw=golferGroup.rotation.y;diagnostics.offerReady=!returning||offerTime>=.55;
}

function initialize(){
 if(state.initialized||!state.loaded||!proGolferAnimator)return;const a=proGolferAnimator,chosen=currentClubIndex;
 slots=GOLF_BAG.map((_,i)=>model.getObjectByName('ClubSlot_'+i));if(slots.some(x=>!x))throw Error('Caddie bag club sockets missing');
 for(let i=0;i<GOLF_BAG.length;i++){a.setClub(GOLF_BAG[i]);clubs[i]=a.clubObject;clubs[i].userData.equipmentClubIndex=i;putInBag(i);}a.setClub(GOLF_BAG[chosen]);
 actor.updateMatrixWorld(true);model.traverse(o=>{if(o.isBone){bones[o.name]=o;originalRest[o.name]={q:o.quaternion.clone(),p:o.position.clone()};}if(o.isSkinnedMesh){o.frustumCulled=false;o.castShadow=true;}});
 bones.Bip01=model.getObjectByName('Bip01');originalRest.Bip01={p:bones.Bip01.position.clone(),q:bones.Bip01.quaternion.clone()};
 for(const side of ['L','R']){const h=bones['Bip01_'+side+'_Hand'],mid=bones['Bip01_'+side+'_Finger2'],index=bones['Bip01_'+side+'_Finger1'],little=bones['Bip01_'+side+'_Finger4'],f=mid.position.clone().normalize(),right=index.position.clone().sub(little.position).normalize(),n=f.clone().cross(right).normalize();right.copy(n).cross(f).normalize();handAxes[side]=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f,right,n));footClearance[side]=Math.max(.045,bones['Bip01_'+side+'_Foot'].getWorldPosition(V()).y);}
 state.initialized=true;reset();if(savedEquipment)restore(savedEquipment);window.PuttUI?.updateShotState(true);event('initialized-13-physical-clubs');
}
let readStart=null,readRise=null,joyStart=null;const readHoles=new Set();
function reset(){if(!state.initialized)return;readStart=readRise=joyStart=null;document.getElementById('celebration-overlay').style.visibility='';if(strokesCurrentHole===0)readHoles.delete((window.activeCourseId||'mis')+':'+currentHoleNumber);for(let i=0;i<clubs.length;i++)putInBag(i);Object.assign(state,{held:null,active:null,pending:null,purpose:null,struck:false,lowerTime:0,holeDone:false});finishPose=null;offerStart=null;addressStart=null;offerTime=0;studyBlend=0;maleLean=0;releaseStart=null;releaseTime=0;restCallback=null;path=[];pathGoal=null;poseRelease=1;holeKey=(window.activeCourseId||'mis')+':'+currentHoleNumber;lastBall.copy(ballPos);actor.position.copy(safePlace());actor.rotation.y=Math.atan2(golferGroup.position.x-actor.position.x,golferGroup.position.z-actor.position.z);phase('empty');syncClubs();}

function atBall(){if(!state.initialized)return;const key=(window.activeCourseId||'mis')+':'+currentHoleNumber;if(key!==holeKey){reset();return;}if(window.GolferLocomotion?.continuous){lastBall.copy(ballPos);return;}if(lastBall.distanceTo(ballPos)>.4&&!isBallFlying&&golferSwingPhase==='idle'){lastBall.copy(ballPos);actor.position.copy(safePlace());path=[];pathGoal=null;if(state.phase==='retire-empty')phase('empty');}}
function request(index){
 if(window.GolferLocomotion?.busy)return false;
 if(!state.initialized||busy()||isBallFlying||golferSwingPhase!=='idle'||!Number.isInteger(index)||index<0||index>=clubs.length)return false;
 if(state.held===index&&state.phase==='ready')return true;
 state.pending=index;state.purpose='delivery';state.struck=false;state.lowerTime=0;state.holeDone=false;finishPose=null;offerStart=null;addressStart=null;pathGoal=null;
 if(state.held!==null){state.active=state.held;phase('return-approach');}else{state.active=index;phase('retrieve');}
 return true;
}

function onShot(){if(!canStrike())return false;state.struck=true;state.lowerTime=0;state.holeDone=false;finishPose=null;offerStart=null;addressStart=null;offerTime=0;state.active=state.held;phase('shot');return true;}

function finishInterruptedShot(){if(!state.initialized||state.held===null)return;if(state.struck&&golferSwingPhase==='idle'){golferSwingPhase='followthrough';golferSwingProgress=0;golferFinishHold=0;golferGroup.visible=true;}state.holeDone=true;state.purpose='post-shot';state.pending=null;state.active=state.held;state.struck=true;pathGoal=null;if(state.phase==='shot'||state.phase==='ready')phase('return-approach');}

function retainedPutter(){return state.held!==null&&!!GOLF_BAG[state.held].isPutter&&!state.holeDone&&state.purpose!=='delivery';}
function deferRest(callback){
 if(!state.initialized)return false;
 if(retainedPutter()){
  if(golferSwingPhase==='followthrough'||golferSwingPhase==='fade'&&golferFinishHold>0){restCallback=callback;return true;}
  state.struck=false;state.active=state.held;phase('ready');return false;
 }
 if(state.struck||state.held!==null){restCallback=callback;return true;}return false;
}

function finishStored(){
 putInBag(state.active);state.held=null;
 if(state.purpose==='delivery'&&state.pending!==null){state.active=state.pending;offerStart=null;phase('retrieve');}
 else{state.struck=false;state.active=null;state.pending=null;if(state.holeDone&&!isBallFlying&&golferSwingPhase==='fade'&&golferFinishHold<=0){golferSwingPhase='idle';golferSwingProgress=0;}phase('retire-empty');const callback=restCallback;restCallback=null;if(callback)callback();window.PuttUI?.saveSession();}
}
function busy(){return !state.initialized||!['empty','ready','follow','shot','retire-empty'].includes(state.phase);}
function needsRead(){return state.initialized&&state.phase==='ready'&&state.held!==null&&GOLF_BAG[state.held].isPutter&&!state.struck&&!isBallFlying&&golferSwingPhase==='idle'&&!window.GolferLocomotion?.busy&&window.GolferLocomotion?.near(ballPos)&&!readHoles.has((window.activeCourseId||'mis')+':'+currentHoleNumber);}
function canStrike(){const d=actor.position.clone().sub(ballPos),inShot=d.dot(aimDirection)>0&&Math.abs(d.x*aimDirection.z-d.z*aimDirection.x)<3;return !needsRead()&&!window.GolferLocomotion?.busy&&!inShot&&state.initialized&&state.phase==='ready'&&state.held===currentClubIndex&&owners[currentClubIndex]==='golfer'&&distance()>=PARK_CLEARANCE&&!isBallFlying&&golferSwingPhase==='idle';}
function restore(data){if(Array.isArray(data?.readHoles))for(const key of data.readHoles)if(typeof key==='string')readHoles.add(key);savedEquipment=data;if(!state.initialized)return;reset();if(Array.isArray(data?.readHoles))for(const key of data.readHoles)if(typeof key==='string')readHoles.add(key);if(data?.schema===1&&Number.isInteger(data.heldClub)&&data.heldClub===currentClubIndex&&data.heldClub>=0&&data.heldClub<clubs.length){giveGolfer(data.heldClub);state.active=data.heldClub;phase('ready');}savedEquipment=null;syncClubs();}
function tick(dt){
 initialize();if(!state.initialized)return;atBall();if(window.GreenReader?.enabled){syncClubs();return;}
 actor.visible=document.body.dataset.view==='game'&&(!isCameraTransitioning||isBallFlying);if(document.body.dataset.view!=='game')return;
 const key=(window.activeCourseId||'mis')+':'+currentHoleNumber;
 if(needsRead()){
  readHoles.add(key);readStart=proGolferAnimator.behaviorSnapshot();readRise=null;phase('read-green');window.PuttUI?.saveSession();
 }
 state.time+=dt;walking=false;const name=state.phase;let crouch=0;
 if(name==='empty'||name==='ready'||name==='follow'||name==='retire-empty'){
  const delta=actor.position.clone().sub(golferGroup.position),forward=delta.dot(aimDirection),cross=Math.abs(delta.x*aimDirection.z-delta.z*aimDirection.x);
  if(distance()<PARK_CLEARANCE+.08||(forward>0&&cross<3)||name==='retire-empty'||name==='follow'){
   const goal=pathGoal||safePlace();if(move(goal,dt)){pathGoal=null;phase(state.held===null?'empty':'ready');window.PuttUI?.saveSession();}else if(name!=='retire-empty')phase('follow');
  }else lookAtAthlete(dt);
 }else if(name==='shot'){
  lookAtAthlete(dt);
  if(retainedPutter()){
   if(golferSwingPhase==='fade'&&golferFinishHold<=0){state.struck=false;state.active=state.held;phase('ready');const cb=restCallback;restCallback=null;if(cb)cb();}
  }else if(golferSwingPhase==='followthrough'||golferSwingPhase==='fade'){state.purpose='post-shot';state.pending=null;state.active=state.held;pathGoal=null;phase('return-approach');}
 }else if(name==='return-approach'||name==='deliver-approach'){
  const waiting=name==='return-approach'&&(golferSwingPhase==='followthrough'||golferSwingPhase==='fade'&&(golferFinishHold>0||offerTime<.55));
  const goal=handoffPlace(waiting);if(move(goal,dt)&&!waiting){pathGoal=null;phase(name==='return-approach'?'take':'give');}if(name==='deliver-approach')clubAt(carryPose());
 }else if(name==='take'){
  grasp=.16;lookAtAthlete(dt);crouch=0;if(state.time>=.38&&diagnostics.handError<.02&&diagnostics.golferHandError<.02){releaseStart=saveBones(proGolferAnimator);releaseTime=0;takeCarrier(state.held);state.held=null;poseRelease=0;phase('receive');}
 }else if(name==='receive'){
  lookAtAthlete(dt);crouch=.18*(1-smooth(state.time/.28));if(!stageStart)stageStart=worldPose(clubs[state.active]);clubAt(blendPose(stageStart,carryPose(),smooth(state.time/.28)));grasp=T.MathUtils.lerp(.16,.07,smooth(state.time/.28));if(state.time>=.28)phase('stow-prepare');
 }else if(name==='retrieve'){
  lookAtAthlete(dt);crouch=.10*smooth(state.time/.18);grasp=.79;if(state.time>.22&&diagnostics.handError<.02){takeCarrier(state.active);phase('extract');}
 }else if(name==='extract'){
  lookAtAthlete(dt);crouch=.12*(1-smooth((state.time-.08)/.26));const start=bagPose(state.active),end=bagPose(state.active,.87);clubAt(blendPose(start,end,smooth((state.time-.08)/.34)));grasp=T.MathUtils.lerp(.79,.49,smooth((state.time-.08)/.34));if(state.time>=.42)phase('prepare');
 }else if(name==='prepare'||name==='stow-prepare'){
  lookAtAthlete(dt);if(!stageStart)stageStart=worldPose(clubs[state.active]);const t=smooth(state.time/.30),target=name==='prepare'?carryPose():bagPose(state.active,.87);clubAt(blendPose(stageStart,target,t));grasp=name==='prepare'?T.MathUtils.lerp(.49,.07,t):T.MathUtils.lerp(.07,.49,t);if(state.time>=.30)phase(name==='prepare'?'deliver-approach':'insert');
 }else if(name==='insert'){
  lookAtAthlete(dt);clubAt(blendPose(bagPose(state.active,.87),bagPose(state.active),smooth(state.time/.38)));grasp=T.MathUtils.lerp(.49,.79,smooth(state.time/.38));if(state.time>=.38)finishStored();
 }else if(name==='give'){
  lookAtAthlete(dt);crouch=0;if(!stageStart)stageStart=worldPose(clubs[state.active]);const target=worldPose(proGolferAnimator.grip);clubAt(blendPose(stageStart,target,smooth(state.time/.40)));grasp=.14;if(state.time>=.44&&diagnostics.handError<.02&&diagnostics.golferHandError<.02&&worldPose(clubs[state.active]).p.distanceTo(target.p)<.025){giveGolfer(state.active);state.pending=null;state.purpose=null;pathGoal=null;phase('retire-equipped');}
 }else if(name==='retire-equipped'){
  const goal=pathGoal||safePlace();if(move(goal,dt)&&state.time>=.55){pathGoal=null;positionGolferAtBall();phase('ready');offerStart=null;addressStart=null;window.PuttUI?.saveSession();}
 }
 animatePerson(dt,crouch);poseGolfer(dt);
 if(state.phase==='give'||state.phase==='take'){const i=state.phase==='give'?state.active:state.held;if(i!==null)settleHandoff(clubs[i].localToWorld(V(0,0,0)),dt,crouch);}
 if(state.active!==null&&owners[state.active]==='caddie'){
  const club=clubs[state.active],target=club.localToWorld(V(0,grasp,0)),axis=Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ));handTarget('R',target,axis,V(0,0,1).applyQuaternion(actor.getWorldQuaternion(tempQ)));
  if(state.phase==='prepare'||state.phase==='stow-prepare'){const u=bones.Bip01_L_UpperArm,m=bones.Bip01_L_Forearm,h=bones.Bip01_L_Hand,p=u.getWorldPosition(V()),e=m.getWorldPosition(V()),w=h.getWorldPosition(V()),root=club.getWorldPosition(V()),at=clamp(p.clone().sub(root).dot(axis),.12,.65),support=club.localToWorld(V(0,at,0));if(p.distanceTo(support)<(p.distanceTo(e)+e.distanceTo(w))*.94)handTarget('L',support,axis);}
 }else if(state.phase==='retrieve'){handTarget('R',clubs[state.active].localToWorld(V(0,.79,0)),Y.clone().applyQuaternion(clubs[state.active].getWorldQuaternion(tempQ)));
 }else if(state.phase==='take'&&state.held!==null){const club=clubs[state.held];handTarget('R',club.localToWorld(V(0,.16,0)),Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ)));}
 syncClubs();actor.updateMatrixWorld(true);diagnostics.bodyRootGap=distance();diagnostics.phase=state.phase;diagnostics.owners=[...owners];diagnostics.safeDistance=distance();diagnostics.ready=canStrike();diagnostics.finite=actor.position.toArray().every(Number.isFinite)&&clubs.every(o=>o.position.toArray().every(Number.isFinite));
}
function onHole(){if(!state.initialized||state.held===null||!proGolferAnimator.celebratePose)return false;state.holeDone=true;state.purpose='post-shot';state.pending=null;state.active=state.held;state.struck=true;joyStart=proGolferAnimator.behaviorSnapshot();phase('celebrate');return true;}
const api={actor,diagnostics,onHole,get controlsPose(){return controlsPose();},get retainPutter(){return retainedPutter();},get heldIndex(){return state.held;},request,onShot,finishInterruptedShot,tick,reset,atBall,deferRest,restore,exportState:()=>({schema:1,heldClub:!state.initialized&&savedEquipment?.schema===1?savedEquipment.heldClub:['ready','read-green'].includes(state.phase)?state.held:null,readHoles:[...readHoles]}),get loaded(){return state.loaded;},get initialized(){return state.initialized;},get busy(){return busy();},get canStrike(){return canStrike();},get phase(){return state.phase;},get heldClub(){return state.held===null?null:GOLF_BAG[state.held];},get empty(){return state.held===null;},get state(){return{...state,owners:[...owners]};}};window.CaddieSystem=api;
window.CaddieReady=new T.GLTFLoader().loadAsync('./characters/caddie.glb').then(gltf=>{model=gltf.scene;actor.add(model);mixer=new T.AnimationMixer(model);idle=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Idle'));walk=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Walk'));idle.play();walk.play();state.loaded=true;return true;});
})();
