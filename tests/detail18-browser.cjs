const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
fs.mkdirSync('audit/character12',{recursive:true});
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[],shader=[],rows=[];
try {for(const [width,height]of [[390,844],[723,1278],[1366,768]]){
const page=await browser.newPage({viewport:{width,height},reducedMotion:'reduce'});page.setDefaultTimeout(90000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')shader.push(m.text())});
await page.goto(process.env.GAME_URL||'http://localhost:8080/');await page.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&window.PuttBoot?.ready&&document.getElementById('runtime-boot').hidden);
await page.click('#btn-splash-enter');await page.click('#skill-continue');await page.click('#course-continue');await page.click('#btn-mode-18holes');
await page.evaluate(()=>{window.PuttBootPaused=true;setupHole(1);});
for(let shot=1;shot<=3;shot++){
 const frame=await page.evaluate(()=>{
  setAddressCamera(true);positionGolferAtBall();PuttUI.updateShotState(true);proGolferAnimator.pose((GOLF_BAG[currentClubIndex]||{}).isPutter?'putt':currentSwingMode,'idle',0);camera.updateMatrixWorld(true);
  const min=new THREE.Vector2(Infinity,Infinity),max=new THREE.Vector2(-Infinity,-Infinity);let bindMin=Infinity,bindMax=-Infinity;const soles={L:Infinity,R:Infinity};
  for(const m of proGolferAnimator.skinMeshes){if(/^(DriverHead|IronHead|PutterHead|ClubShaft|ClubGrip)$/.test(m.name))continue;
   const a=m.geometry.attributes;
   for(let i=0;i<a.position.count;i++){
    const rest=new THREE.Vector3().fromBufferAttribute(a.position,i);bindMin=Math.min(bindMin,rest.y);bindMax=Math.max(bindMax,rest.y);
    const v=rest.clone();m.boneTransform(i,v);v.applyMatrix4(m.matrixWorld);
    if(rest.y<.04){for(let k=0;k<4;k++)if(a.skinWeight.array[i*4+k]>.8){const b=m.skeleton.bones[a.skinIndex.array[i*4+k]];if(/^Foot[LR]$/.test(b.name)){const ground=strokesCurrentHole===0?getTerrainHeight(ballPos.x,ballPos.z)+.15:getTerrainHeight(v.x,v.z);const side=b.name.at(-1);soles[side]=Math.min(soles[side],v.y-ground);}}}
    const s=v.project(camera),sx=(s.x*.5+.5)*innerWidth,sy=(-s.y*.5+.5)*innerHeight;min.min(new THREE.Vector2(sx,sy));max.max(new THREE.Vector2(sx,sy));
   }
  }
  return {strokes:strokesCurrentHole,club:GOLF_BAG[currentClubIndex].id,ballRadius:BALL_RADIUS,ballGroundClearance:ballPos.y-getTerrainHeight(ballPos.x,ballPos.z),bindHeight:bindMax-bindMin,scale:golferGroup.scale.toArray(),modelScale:proGolferModel.scale.toArray(),screenMin:min.toArray(),screenMax:max.toArray(),screenHeight:max.y-min.y,cameraDistance:camera.position.distanceTo(ballPos),soles,tagVisible:getComputedStyle(document.getElementById('toptracer-yardage-tag')).display!=='none',heading:aimDirection.toArray()};
 });
 assert.equal(frame.strokes,shot-1);assert.equal(frame.ballRadius,.021335);assert.deepEqual(frame.scale,[1,1,1]);assert.deepEqual(frame.modelScale,[1,1,1]);assert.ok(frame.bindHeight>1.78&&frame.bindHeight<1.85);assert.ok(frame.screenHeight<height*.65,JSON.stringify(frame));assert.ok(frame.screenMin[0]>=0&&frame.screenMax[0]<=width,JSON.stringify(frame));
 for(const v of Object.values(frame.soles))assert.ok(Number.isFinite(v)&&v>-.025&&v<.035,JSON.stringify(frame));
 if(shot>1){assert.ok(Math.abs(frame.ballGroundClearance-.021335)<1e-5);assert.equal(frame.tagVisible,false);}
 rows.push({width,height,shot,...frame});
 await page.evaluate(()=>renderer.render(scene,camera));await page.screenshot({path:`audit/character12/shot-${shot}-${width}.png`,animations:'disabled'});
 if(shot===3)break;
 // Actual UI handler -> actual impact callback -> actual course physics. No fake scores/shot results.
 await page.click('#btn-launch-shot');const result=await page.evaluate(()=>{
  const started=golferSwingPhase;let launchFrames=0;while(!isBallFlying&&launchFrames++<240)updateGolferAnimation(1/120);
  if(!isBallFlying)throw Error('UI swing did not launch');
  let frames=0;while(isBallFlying&&frames++<18000){stepPhysics(1/120);updateGolferAnimation(1/120);}
  if(isBallFlying)throw Error('Shot failed to settle');
  const distance=Math.round(Math.hypot(ballPos.x-shotStartPos.x,ballPos.z-shotStartPos.z)*1.09361);
  const stale=getComputedStyle(document.getElementById('toptracer-yardage-tag')).display!=='none';
  let oversized=0;for(let n=0;n<600&&isCameraTransitioning;n++){updateAddressCamera(1/60);if(isCameraTransitioning&&golferGroup.visible)oversized++;}
  updateAddressCamera(1/60);return {started,frames,strokes:strokesCurrentHole,distance,stale,transition:isCameraTransitioning,oversized,visible:golferGroup.visible,summary:document.getElementById('tele-total').textContent};
 });assert.equal(result.stale,false);assert.equal(result.transition,false);assert.equal(result.oversized,0);assert.equal(result.visible,true);assert.equal(result.strokes,shot);rows.push({width,launchedShot:shot,result});
}
// Exact screenshot symptom: 16yd carry + 6yd roll = stale floating 22; keep summary, hide overlay.
const tag=await page.evaluate(()=>{
 const start=shotStartPos.clone();shotStartPos.copy(ballPos).addScaledVector(aimDirection,-22/1.09361);updateToptracerYardageTag(ballPos);const number=document.getElementById('toptracer-yardage-tag').textContent;shotStartPos.copy(start);
 hideToptracerYardageTag();return {number,display:getComputedStyle(document.getElementById('toptracer-yardage-tag')).display};
});assert.ok(tag.number.includes('22'));assert.equal(tag.display,'none');rows.push({width,tag});
await page.close();}
assert.deepEqual(errors,[]);assert.deepEqual(shader,[]);fs.writeFileSync('audit/character12/browser-results.json',JSON.stringify({rows,errors,shader},null,2));console.log(JSON.stringify({passed:true,views:3,realShots:6,addressFrames:9,rows,errors,shader},null,2));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exit(1)});
