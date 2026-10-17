/* Isolated gameplay for زمین باشگاه پات کلاب. Old course physics stays in game.js. */
let courseLegacyState=null,courseRelief=null,courseBallPlugged=false,courseShotOrigin=null,courseLastEntries={},courseReliefOptions=[];
const courseEvents=[];
let courseTeeColor="blue";
async function activatePuttClubCourse(enabled){
 const pc=window.PuttClubCourse;
 if(enabled){await pc.loadVisual();pc.native.attachRenderer(renderer);}
 const groups=[terrainMesh,buildingGroup,treeGroup,fairwayGroup,pinGroup,brownsGroup,roadsGroup];
 if(enabled&&!pc.active){
  courseLegacyState={holes:courseHoles,pins:Object.fromEntries(Object.entries(holePins3D).map(([k,p])=>[k,p.clone()])),tees:Object.fromEntries(Object.entries(teeBoxes3D).map(([k,p])=>[k,p.clone()])),visibility:groups.map(g=>g.visible)};
  courseLegacyState.light={hemi:hemiLight.intensity,intensity:sunLight.intensity,color:sunLight.color.clone(),position:sunLight.position.clone(),target:sunLight.target.position.clone(),fog:scene.fog,sky:legacySkyDome.visible,shadow:{left:sunLight.shadow.camera.left,right:sunLight.shadow.camera.right,top:sunLight.shadow.camera.top,bottom:sunLight.shadow.camera.bottom,near:sunLight.shadow.camera.near,far:sunLight.shadow.camera.far}};
  hemiLight.intensity=0;sunLight.intensity=pc.native.spec.sun.energy/Math.PI;sunLight.color.fromArray(pc.native.spec.sun.color);Object.assign(sunLight.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:500});sunLight.shadow.camera.updateProjectionMatrix();scene.fog=null;legacySkyDome.visible=false;pc.lightContext={sun:sunLight};
  courseHoles=pc.holeCards;Object.keys(holePins3D).forEach(k=>delete holePins3D[k]);Object.keys(teeBoxes3D).forEach(k=>delete teeBoxes3D[k]);
  for(const h of pc.data.holes){holePins3D[h.number]=new THREE.Vector3().fromArray(h.pins.find(p=>p.isDefault).position);teeBoxes3D[h.number]=new THREE.Vector3().fromArray(h.tees[0].position);}
  groups.forEach(g=>g.visible=false);scene.add(pc.root);pc.root.visible=true;pc.active=true;
 }else if(!enabled&&pc.active){
  const light=courseLegacyState.light;hemiLight.intensity=light.hemi;sunLight.intensity=light.intensity;sunLight.color.copy(light.color);sunLight.position.copy(light.position);sunLight.target.position.copy(light.target);sunLight.target.updateMatrixWorld();Object.assign(sunLight.shadow.camera,light.shadow);sunLight.shadow.camera.updateProjectionMatrix();scene.fog=light.fog;legacySkyDome.visible=light.sky;pc.lightContext=null;
  pc.active=false;pc.root.visible=false;courseHoles=courseLegacyState.holes;Object.keys(holePins3D).forEach(k=>delete holePins3D[k]);Object.keys(teeBoxes3D).forEach(k=>delete teeBoxes3D[k]);Object.assign(holePins3D,courseLegacyState.pins);Object.assign(teeBoxes3D,courseLegacyState.tees);groups.forEach((g,i)=>g.visible=courseLegacyState.visibility[i]);
 }
 courseRelief=null;document.getElementById('course-relief')?.setAttribute('hidden','');
}
function resetPuttClubHole(){courseRelief=null;courseBallPlugged=false;courseLastEntries={};courseShotOrigin=null;window.PuttClubCourse.canopies.clear();document.getElementById('course-relief')?.setAttribute('hidden','');}
function beginPuttClubShot(){courseShotOrigin={position:ballPos.toArray(),fromTee:teePegGroup.visible};window.PuttClubCourse.canopies.clear();}
function courseSupport(x,z){const pin=holePins3D[currentHoleNumber];if(pin&&Math.hypot(x-pin.x,z-pin.z)<.085)return pin.y-.001;return getTerrainHeight(x,z);}
function checkPuttClubCup(from,to){
 const pin=holePins3D[currentHoleNumber];if(!pin)return false;const dx=to.x-from.x,dz=to.z-from.z,den=dx*dx+dz*dz,t=den?THREE.MathUtils.clamp(((pin.x-from.x)*dx+(pin.z-from.z)*dz)/den,0,1):0,x=from.x+t*dx,z=from.z+t*dz;
 if(Math.hypot(x-pin.x,z-pin.z)<=.054-BALL_RADIUS&&Math.hypot(ballVel.x,ballVel.z)<1.8&&to.y<=pin.y+BALL_RADIUS+.06){ballPos.set(pin.x,pin.y-.085,pin.z);ballMesh.position.copy(ballPos);ballVel.set(0,0,0);isBallFlying=false;isBallSettled=false;golferSwingPhase='idle';golferImpactCallback=null;courseEvents.push({type:'cup',hole:currentHoleNumber,strokes:strokesCurrentHole});handleHoleCompleted();return true;}return false;
}
function pendingPuttClubRelief(kind,hazard=null){
 const origin=courseShotOrigin||{position:shotStartPos.toArray(),fromTee:false};courseRelief={kind,hazardId:hazard?.id||null,cross:hazard&&courseLastEntries[hazard.id]?courseLastEntries[hazard.id].toArray():null,shotStart:origin.position,fromTee:origin.fromTee,ball:ballPos.toArray()};
 golferSwingPhase='idle';golferSwingProgress=0;golferImpactCallback=null;isCameraTransitioning=false;
 ballVel.set(0,0,0);ballMesh.position.copy(ballPos);isBallFlying=false;isBallSettled=false;isBallGrounded=true;hideToptracerYardageTag();aimLine.visible=false;golferGroup.visible=false;teePegGroup.visible=false;courseEvents.push({type:kind,hole:currentHoleNumber,hazard:hazard?.id,cross:courseRelief.cross});showPuttClubRelief();window.PuttUI?.updateShotState(true);window.PuttUI?.saveSession?.();
}
function showPuttClubRelief(){
 if(!courseRelief)return;
 golferGroup.visible=false;aimLine.visible=false;
 let el=document.getElementById('course-relief');
 if(!el){el=document.createElement('section');el.id='course-relief';el.className='course-relief';el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','course-relief-title');el.dir='rtl';el.innerHTML='<div class="course-relief-card"><h2 id="course-relief-title"></h2><p id="course-relief-description"></p><div id="course-relief-options"></div><p class="course-relief-footnote">ریلیف آب بر مبنای آخرین عبور از مرز است؛ نه نزدیک‌ترین ساحل. طول کلاب مبنا: ۱٫۱۵ متر.</p></div>';document.body.appendChild(el);el.addEventListener('keydown',e=>{if(e.key==='Tab'){const bs=[...el.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===bs[0]){e.preventDefault();bs.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===bs.at(-1)){e.preventDefault();bs[0].focus();}}if(e.key==='Escape'){e.preventDefault();e.stopPropagation();}},true);}
 window.PuttUI?.closePanel(false);document.getElementById('game-ui').inert=true;
 document.getElementById('course-relief-title').textContent=courseRelief.kind==='ob'?'توپ خارج از محدودهٔ زمین':courseRelief.kind==='dry'?'توپ در محدودهٔ جریمه، روی خشکی':'توپ وارد آب شد';
 document.getElementById('course-relief-description').textContent='گزینهٔ رهاسازی را انتخاب کنید. فقط پس از انتخاب ریلیف، یک ضربهٔ جریمه به شمارش واقعی اضافه می‌شود.';
 courseReliefOptions=window.PuttClubCourse.reliefOptions(courseRelief,holePins3D[currentHoleNumber],currentHoleNumber);const list=document.getElementById('course-relief-options');list.replaceChildren();for(const o of courseReliefOptions){const b=document.createElement('button');b.className='secondary-btn';b.type='button';b.dataset.relief=o.id;b.textContent=o.label;b.onclick=()=>applyPuttClubRelief(o.id);list.appendChild(b);}el.hidden=false;list.querySelector('button')?.focus();
}
function applyPuttClubRelief(id){
 if(!courseRelief)return;const o=window.PuttClubCourse.reliefOptions(courseRelief,holePins3D[currentHoleNumber],currentHoleNumber).find(o=>o.id===id);if(!o)return;
 if(id!=='play')strokesCurrentHole++;
 ballPos.copy(o.position);if(!o.tee)ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+BALL_RADIUS;
 ballVel.set(0,0,0);ballMesh.position.copy(ballPos);teePegGroup.visible=!!o.tee;if(o.tee)teePegGroup.position.set(ballPos.x,getTerrainHeight(ballPos.x,ballPos.z),ballPos.z);
 courseEvents.push({type:'relief',option:id,penalty:id==='play'?0:1,strokes:strokesCurrentHole,position:ballPos.toArray(),cross:courseRelief.cross});courseRelief=null;courseBallPlugged=false;document.getElementById('course-relief').hidden=true;document.getElementById('game-ui').inert=false;
 resetToptracer();resetAimToPin();setAddressCamera(true);autoSuggestClub();updateHoleUI();positionGolferAtBall();drawMinimap();document.getElementById('shot-telemetry-hud').style.display='none';window.PuttUI?.sync();window.PuttUI?.updateShotState(true);window.PuttUI?.saveSession?.();
}
function exportPuttClubState(){return {plugged:courseBallPlugged,pending:courseRelief,entries:Object.fromEntries(Object.entries(courseLastEntries).map(([k,v])=>[k,v.toArray()])),origin:courseShotOrigin};}
function restorePuttClubState(s){courseBallPlugged=!!s?.plugged;courseLastEntries=Object.fromEntries(Object.entries(s?.entries||{}).map(([k,v])=>[k,new THREE.Vector3().fromArray(v)]));courseShotOrigin=s?.origin||null;courseRelief=s?.pending||null;if(courseRelief)showPuttClubRelief();}
function settlePuttClubBall(){
 const pc=window.PuttClubCourse;ballVel.set(0,0,0);isBallFlying=false;isBallSettled=false;
 if(!pc.inPlay(ballPos)){pendingPuttClubRelief('ob');return;}
 const area=pc.areaAt(ballPos);if(area){pendingPuttClubRelief('dry',area);return;}
 if(pc.surface(ballPos.x,ballPos.z).type!=='bunker')courseBallPlugged=false;handleBallCameToRest();window.PuttUI?.saveSession?.();
}
function stepPuttClubPhysics(dt){
 if(!isBallFlying||courseRelief)return;
 const pc=window.PuttClubCourse,club=GOLF_BAG[currentClubIndex],steps=Math.max(6,Math.min(96,Math.ceil(ballVel.length()*dt/.14))),sdt=dt/steps;
 for(let s=0;s<steps;s++){
  const previous=ballPos.clone();
  if(!isBallGrounded){
   stepBallFlight(ballPos,ballVel,sdt,!hasImpacted&&!club.isPutter);const hit=pc.collideTrees(previous,ballPos,ballVel,BALL_RADIUS);if(hit)courseEvents.push({type:hit.kind,tree:hit.treeId});
   const ground=courseSupport(ballPos.x,ballPos.z)+BALL_RADIUS;
   if(ballPos.y<=ground){
    // Find the surface crossing along the step instead of projecting a fast ball through a slope.
    let lo=0,hi=1;if(previous.y>courseSupport(previous.x,previous.z)+BALL_RADIUS)for(let i=0;i<12;i++){const m=(lo+hi)/2,p=previous.clone().lerp(ballPos,m);if(p.y>courseSupport(p.x,p.z)+BALL_RADIUS)lo=m;else hi=m;}else hi=1;
    ballPos.copy(previous.clone().lerp(ballPos,hi));ballPos.y=courseSupport(ballPos.x,ballPos.z)+BALL_RADIUS;
    const lie=pc.surface(ballPos.x,ballPos.z),sand=lie.type==='bunker',normal=getTerrainNormal(ballPos.x,ballPos.z),vn=ballVel.dot(normal);if(!hasImpacted){hasImpacted=true;firstImpactPos.copy(ballPos);AudioEngine.playBallLand(sand);}
    const retention=sand?Math.sqrt(1-(lie.physicsBehavior?.energyAbsorptionOnLanding??.78)):1,restitution=(club.bounceRest??.22)*retention,tangent=(club.tangentLoss??.65)*retention;
    if(sand&&vn<-4){courseBallPlugged=true;courseEvents.push({type:'plugged-lie',normalSpeed:-vn});}
    if(vn<0){const norm=normal.clone().multiplyScalar(vn),tan=ballVel.clone().sub(norm).multiplyScalar(tangent);ballVel.copy(norm.multiplyScalar(-restitution)).add(tan);}
    if(ballVel.dot(normal)<.35){isBallGrounded=true;ballVel.y=0;}
   }
  }else{
   const info=pc.height(ballPos.x,ballPos.z,true),surface=pc.surface(ballPos.x,ballPos.z),n=info.normal;
   let decel=surface.type==='green'?.48:surface.type==='fringe'?.95:surface.type==='bunker'?1.6*(surface.physicsBehavior?.rollFrictionMultiplier||4.5):surface.type==='heavy_rough'?5:surface.type==='rough'?3:1.6;
   const ax=n.x*n.y*gravity*5/7,az=n.z*n.y*gravity*5/7;ballVel.x+=ax*sdt;ballVel.z+=az*sdt;ballVel.y=0;const speed=Math.hypot(ballVel.x,ballVel.z),loss=decel*sdt;
   if(speed>loss){ballVel.x*=1-loss/speed;ballVel.z*=1-loss/speed;}else if(Math.hypot(ax,az)<decel){ballVel.set(0,0,0);}
   ballPos.x+=ballVel.x*sdt;ballPos.z+=ballVel.z*sdt;ballPos.y=courseSupport(ballPos.x,ballPos.z)+BALL_RADIUS;
   pc.collideTrees(previous,ballPos,ballVel,BALL_RADIUS);
   if(checkPuttClubCup(previous,ballPos))return;
   const moved=Math.hypot(ballPos.x-previous.x,ballPos.z-previous.z);ballMesh.rotation.x+=(ballPos.z-previous.z)/BALL_RADIUS;ballMesh.rotation.z-=(ballPos.x-previous.x)/BALL_RADIUS;
  }
  pc.crossings(previous,ballPos,courseLastEntries);
  const wet=pc.wetAt(ballPos);if(wet){pendingPuttClubRelief('water',wet);return;}
  if(!pc.inPlay(ballPos)&&ballPos.y<-7){pendingPuttClubRelief('ob');return;}
  if(isBallGrounded&&ballVel.length()<.035){isBallSettled=true;break;}
 }
 ballMesh.position.copy(ballPos);updateToptracerRibbon(ballPos);
 if(isBallSettled){ballRestTimer+=dt;if(ballRestTimer>.65)settlePuttClubBall();}
}
