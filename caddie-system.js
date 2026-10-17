/* Caddie30 — real skinned human, one physical instance of each calibrated club.
 * Human base and source Walk/Idle: Microsoft Rocketbox, MIT (see characters/LICENSE.txt).
 * Equipment FSM is separate from GolfMotion and the shot integrator. */
(() => {
'use strict';
const T=THREE,V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),Y=V(0,1,0),clamp=T.MathUtils.clamp;
const smooth=x=>{x=clamp(x,0,1);return x*x*(3-2*x);};
const actor=new T.Group();actor.name='PuttClubHumanCaddie';actor.visible=false;scene.add(actor);
const carrier=new T.Group();carrier.name='ActualClubInExchange';scene.add(carrier);
const state={loaded:false,initialized:false,phase:'loading',time:0,held:null,active:null,purpose:null,pending:null,struck:false,lowerTime:0};
const diagnostics={version:'caddie30',source:'Microsoft Rocketbox Female_Adult_01 / MIT',events:[],transfers:0,handError:0,finite:true,pathFailures:0};
let model,mixer,idle,walk,bones={},slots=[],clubs=[],owners=[],path=[],pathGoal=null,restCallback=null,savedEquipment=null,finishPose=null,poseRelease=1,lastBall=V(Infinity,0,0),holeKey='',stageStart=null,stageEnd=null,grasp=.07,walking=false,navRetry=0;
const originalRest={},footClearance={},handAxes={},tempQ=new T.Quaternion();
function event(name,index=state.active){diagnostics.events.push({event:name,club:index,phase:state.phase,stroke:strokesCurrentHole});if(diagnostics.events.length>160)diagnostics.events.shift();}
function phase(name){state.phase=name;state.time=0;stageStart=null;stageEnd=null;event(name);window.PuttUI?.updateShotState(true);if(['ready','empty'].includes(name)&&canAdjustAim())updateAimTracer();}
function worldPose(o){o.updateWorldMatrix(true,false);return{p:o.getWorldPosition(V()),q:o.getWorldQuaternion(new T.Quaternion())};}
function setWorld(o,p,q){o.parent.updateWorldMatrix(true,false);o.position.copy(o.parent.worldToLocal(p.clone()));o.quaternion.copy(o.parent.getWorldQuaternion(new T.Quaternion()).invert().multiply(q));o.scale.set(1,1,1);o.updateMatrixWorld(true);}
function putInBag(i){const o=clubs[i];slots[i].add(o);o.position.set(0,0,0);o.quaternion.identity();o.scale.set(1,1,1);owners[i]='bag';o.visible=true;event('stored-in-bag',i);}
function takeCarrier(i){const pose=worldPose(clubs[i]);carrier.add(clubs[i]);setWorld(clubs[i],pose.p,pose.q);owners[i]='caddie';state.active=i;diagnostics.transfers++;event('caddie-took-physical-club',i);}
function giveGolfer(i){const a=proGolferAnimator;a.grip.add(clubs[i]);clubs[i].position.set(0,0,0);clubs[i].quaternion.identity();clubs[i].scale.set(1,1,1);owners[i]='golfer';state.held=i;poseRelease=0;a.setClub(GOLF_BAG[i]);diagnostics.transfers++;event('delivered-to-golfer',i);}
function syncClubs(){if(!state.initialized)return;for(let i=0;i<clubs.length;i++)clubs[i].visible=true;}
function distance(){return Math.hypot(actor.position.x-golferGroup.position.x,actor.position.z-golferGroup.position.z);}
function clearGround(p,park=false){
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
 const p=proGolferAnimator.grip.getWorldPosition(V()),face=V(aimDirection.z,0,-aimDirection.x); // face the athlete, from the ball side
 for(const angle of [0,.35,-.35,.7,-.7,1.2,-1.2,1.6,-1.6,2.5,Math.PI]){const f=face.clone().applyAxisAngle(Y,angle),r=V(f.z,0,-f.x),q=p.clone().addScaledVector(f,-.27).addScaledVector(r,-.17);q.y=getTerrainHeight(q.x,q.z);if(clearGround(q))return q;}
 return p.clone().addScaledVector(face,-.30).setY(getTerrainHeight(p.x-face.x*.30,p.z-face.z*.30));
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
function move(goal,dt){navRetry=Math.max(0,navRetry-dt);const gap=Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z);if(!pathGoal||pathGoal.distanceTo(goal)>.30||(!path.length&&gap>=.008&&navRetry===0)){navRetry=plan(goal)?0:.75;}let remaining=dt*1.55;walking=false;
 while(path.length&&remaining>0){const q=path[0],d=V(q.x-actor.position.x,0,q.z-actor.position.z),len=d.length();if(len<.005){actor.position.x=q.x;actor.position.z=q.z;path.shift();continue;}const n=Math.min(len,remaining);actor.position.addScaledVector(d,n/len);remaining-=n;walking=true;const target=Math.atan2(d.x,d.z),delta=Math.atan2(Math.sin(target-actor.rotation.y),Math.cos(target-actor.rotation.y));actor.rotation.y+=delta*Math.min(1,dt*10);if(n>=len-.001)path.shift();}
 actor.position.y=getTerrainHeight(actor.position.x,actor.position.z);return Math.hypot(actor.position.x-goal.x,actor.position.z-goal.z)<.008;
}
function lookAtAthlete(dt){const p=proGolferAnimator.grip.getWorldPosition(V()),yaw=Math.atan2(p.x-actor.position.x,p.z-actor.position.z),d=Math.atan2(Math.sin(yaw-actor.rotation.y),Math.cos(yaw-actor.rotation.y));actor.rotation.y+=d*Math.min(1,dt*12);}
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
 if(need>.001&&horizontal>.001){const q=actor.position.clone();q.x+=(target.x-p.x)/horizontal*Math.min(need,dt*.55);q.z+=(target.z-p.z)/horizontal*Math.min(need,dt*.55);if(clearGround(q)&&Math.hypot(q.x-golferGroup.position.x,q.z-golferGroup.position.z)>.44){actor.position.x=q.x;actor.position.z=q.z;actor.position.y=getTerrainHeight(q.x,q.z);animatePerson(0,crouch);}}
}
function animatePerson(dt,crouch=0){
 const weight=walking?1:0;walk.enabled=true;idle.enabled=true;walk.setEffectiveWeight(weight);idle.setEffectiveWeight(1-weight);walk.setEffectiveTimeScale(1.55/1.7);mixer.update(dt);
 if(document.body.dataset.reducedMotion==='true'||sceneMotionPreference.matches){if(!walking)idle.time=.7;}
 bones.Bip01.position.y=originalRest.Bip01.p.y-crouch*100;actor.updateMatrixWorld(true);
 for(const side of ['L','R']){const foot=bones['Bip01_'+side+'_Foot'],p=foot.getWorldPosition(V()),baseY=actor.position.y+footClearance[side],lift=Math.max(0,p.y-baseY+crouch),target=p.clone();target.y=getTerrainHeight(p.x,p.z)+footClearance[side]+lift;ik(bones['Bip01_'+side+'_Thigh'],bones['Bip01_'+side+'_Calf'],foot,target,V(0,-.1,.7).applyQuaternion(actor.getWorldQuaternion(new T.Quaternion())));}
 // The carrying hand holds the real padded shoulder strap, not empty air.
 handTarget('L',model.getObjectByName('StrapGrip').getWorldPosition(V()),null);
 actor.updateMatrixWorld(true);
}
function poseGolfer(dt){
 const a=proGolferAnimator;if(!state.initialized||!a)return;
 if(state.struck&&golferSwingPhase==='fade'){
  if(!finishPose){finishPose=new Map();a.model.traverse(o=>{if(o.isBone)finishPose.set(o,{p:o.position.clone(),q:o.quaternion.clone()});});}
  state.lowerTime+=dt;const t=smooth(state.lowerTime/.9);a.pose(activeSwingStyle,'idle',0);for(const[o,p]of finishPose){const q=o.quaternion.clone(),v=o.position.clone();o.position.copy(p.p).lerp(v,t);o.quaternion.copy(p.q).slerp(q,t);}a.model.updateMatrixWorld(true);
 }
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
 state.initialized=true;reset();if(savedEquipment)restore(savedEquipment);window.PuttUI?.updateShotState(true);event('initialized-13-physical-clubs');
}
function reset(){if(!state.initialized)return;for(let i=0;i<clubs.length;i++)putInBag(i);Object.assign(state,{held:null,active:null,pending:null,purpose:null,struck:false,lowerTime:0});finishPose=null;restCallback=null;path=[];pathGoal=null;poseRelease=1;holeKey=(window.activeCourseId||'mis')+':'+currentHoleNumber;lastBall.copy(ballPos);actor.position.copy(safePlace());actor.rotation.y=Math.atan2(golferGroup.position.x-actor.position.x,golferGroup.position.z-actor.position.z);phase('empty');syncClubs();}
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
 state.time+=dt;walking=false;poseGolfer(dt);const name=state.phase;let crouch=0;
 if(name==='empty'||name==='ready'||name==='follow'||name==='retire-empty'){
  const delta=actor.position.clone().sub(golferGroup.position),forward=delta.dot(aimDirection),cross=Math.abs(delta.x*aimDirection.z-delta.z*aimDirection.x);
  if(distance()<4.05||(forward>0&&cross<3)||name==='retire-empty'||name==='follow'){
   const goal=pathGoal||safePlace();if(move(goal,dt)){pathGoal=null;phase(state.held===null?'empty':'ready');window.PuttUI?.saveSession();}else if(name!=='retire-empty')phase('follow');
  }else lookAtAthlete(dt);
 }else if(name==='shot'){
  lookAtAthlete(dt);if(golferSwingPhase==='fade'){state.purpose='post-shot';state.pending=null;state.active=state.held;pathGoal=null;phase('return-approach');}
 }else if(name==='return-approach'||name==='deliver-approach'){
  const goal=handoffPlace();if(move(goal,dt)){pathGoal=null;phase(name==='return-approach'?'take':'give');}if(name==='deliver-approach')clubAt(carryPose());
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
  const goal=pathGoal||safePlace();if(move(goal,dt)){pathGoal=null;phase('ready');window.PuttUI?.saveSession();}
 }
 animatePerson(dt,crouch);
 if(state.phase==='give'||state.phase==='take'){const i=state.phase==='give'?state.active:state.held;if(i!==null)settleHandoff(clubs[i].localToWorld(V(0,0,0)),dt,crouch);}
 if(state.active!==null&&owners[state.active]==='caddie'){
  const club=clubs[state.active],target=club.localToWorld(V(0,grasp,0)),axis=Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ));handTarget('R',target,axis,V(0,0,1).applyQuaternion(actor.getWorldQuaternion(tempQ)));
  if(state.phase==='prepare'||state.phase==='stow-prepare'){const u=bones.Bip01_L_UpperArm,m=bones.Bip01_L_Forearm,h=bones.Bip01_L_Hand,p=u.getWorldPosition(V()),e=m.getWorldPosition(V()),w=h.getWorldPosition(V()),root=club.getWorldPosition(V()),at=clamp(p.clone().sub(root).dot(axis),.12,.65),support=club.localToWorld(V(0,at,0));if(p.distanceTo(support)<(p.distanceTo(e)+e.distanceTo(w))*.94)handTarget('L',support,axis);}
 }else if(state.phase==='retrieve'){handTarget('R',clubs[state.active].localToWorld(V(0,.79,0)),Y.clone().applyQuaternion(clubs[state.active].getWorldQuaternion(tempQ)));
 }else if(state.phase==='take'&&state.held!==null){const club=clubs[state.held];handTarget('R',club.localToWorld(V(0,0,0)),Y.clone().applyQuaternion(club.getWorldQuaternion(tempQ)));}
 syncClubs();actor.updateMatrixWorld(true);diagnostics.phase=state.phase;diagnostics.owners=[...owners];diagnostics.safeDistance=distance();diagnostics.ready=canStrike();diagnostics.finite=actor.position.toArray().every(Number.isFinite)&&clubs.every(o=>o.position.toArray().every(Number.isFinite));
}
const api={actor,diagnostics,request,onShot,finishInterruptedShot,tick,reset,atBall,deferRest,restore,exportState:()=>({schema:1,heldClub:state.phase==='ready'?state.held:null}),get loaded(){return state.loaded;},get initialized(){return state.initialized;},get busy(){return busy();},get canStrike(){return canStrike();},get phase(){return state.phase;},get heldClub(){return state.held===null?null:GOLF_BAG[state.held];},get empty(){return state.held===null;},get state(){return{...state,owners:[...owners]};}};window.CaddieSystem=api;
window.CaddieReady=new T.GLTFLoader().loadAsync('./characters/caddie.glb').then(gltf=>{model=gltf.scene;actor.add(model);mixer=new T.AnimationMixer(model);idle=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Idle'));walk=mixer.clipAction(T.AnimationClip.findByName(gltf.animations,'Walk'));idle.play();walk.play();state.loaded=true;return true;});
})();
