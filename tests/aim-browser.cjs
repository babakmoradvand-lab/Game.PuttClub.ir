const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const page=await browser.newPage({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message)});
 page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300))});
 await page.goto(process.env.PUTT_URL||'http://localhost:8080/');
 await page.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded,{},{timeout:90000});
 console.log('boot ready');
 await page.click('#btn-splash-enter');await page.click('#skill-continue');await page.click('#course-continue');await page.click('#btn-mode-18holes');
 await page.waitForFunction(()=>document.body.dataset.view==='game');
 const baseline=await page.evaluate(()=>({radius:BALL_RADIUS,scale:golferGroup.scale.toArray(),offset:camera.position.clone().sub(ballPos).toArray(),version:document.querySelector('meta[name="putt-release"]').content}));
 assert.equal(baseline.radius,.021335);
 assert.equal(baseline.version,'look17-20261014');
 console.log('baseline',baseline);
 for(const degrees of [-180,-90,-45,0,45,90,179,180]) {
  await page.evaluate(d=>setAimAngle(d),degrees);
  const result=await page.evaluate(()=>{
   const yaw=aimBaseYaw+THREE.MathUtils.degToRad(Math.round(THREE.MathUtils.radToDeg(Math.atan2(aimDirection.x,aimDirection.z)-aimBaseYaw)));
   const expected=new THREE.Vector3(Math.sin(yaw),0,Math.cos(yaw));
   const lead=new THREE.Vector3(1,0,0).applyQuaternion(golferGroup.quaternion);
   const geo=aimLine.geometry.attributes.position;const last=new THREE.Vector3().fromBufferAttribute(geo,geo.count-1);
   return {directionError:aimDirection.distanceTo(expected),leadDot:lead.dot(aimDirection),lineVisible:aimLine.visible,lineLength:Math.hypot(last.x-ballPos.x,last.z-ballPos.z),lineDot:last.sub(ballPos).setY(0).normalize().dot(aimDirection),ring:landingRing.visible};
  });
  assert.ok(result.directionError<1e-8);assert.ok(result.leadDot>.99999);assert.ok(result.lineVisible);assert.ok(result.lineLength<=27.433);assert.ok(result.lineDot>.995);assert.equal(result.ring,false);
 }
 console.log('PASS: all aim headings, golfer and short guide');
 await page.evaluate(()=>setAimAngle(90));
 await page.waitForFunction(()=>!isCameraTransitioning,{},{timeout:20000});
 await page.screenshot({path:'aim-desktop.png'});
 // Shot starts through the real button: aim is locked as soon as backswing starts.
 await page.click('#btn-launch-shot');
 const swing=await page.evaluate(()=>({phase:golferSwingPhase,visible:aimLine.visible,accepted:setAimAngle(-90)}));
 assert.notEqual(swing.phase,'idle');assert.equal(swing.visible,false);assert.equal(swing.accepted,false);
 await page.waitForFunction(()=>isBallFlying,{},{timeout:15000});
 const launch=await page.evaluate(()=>({dot:ballVel.clone().setY(0).normalize().dot(aimDirection),guide:aimLine.visible,disabled:!canAdjustAim()}));
 assert.ok(launch.dot>.98);assert.equal(launch.guide,false);assert.equal(launch.disabled,true);
 console.log('PASS: real launch at 90 degrees, aim lock and hidden guide');
 // Deterministic physical rolling on flat ground, including the real rest callback.
 const rolled=await page.evaluate(()=>{
  isBallFlying=false;setupHole(1);currentClubIndex=12;currentSwingMode='full';updateSelectedClubUI();
  strokesCurrentHole=1;ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+BALL_RADIUS;
  const oldHeight=getTerrainHeight;getTerrainHeight=()=>100;const oldNormal=getTerrainNormal;getTerrainNormal=()=>new THREE.Vector3(0,1,0);
  const oldLie=detectLie;detectLie=()=>({type:'Green',penalty:1,name:'Green',badge:'green'});
  ballPos.y=100+BALL_RADIUS;ballVel.set(1,0,0);isBallFlying=true;isBallGrounded=true;hasImpacted=true;shotStartPos.copy(ballPos);firstImpactPos.copy(ballPos);
  for(let i=0;i<600 && isBallFlying;i++)stepPhysics(1/60);
  const result={flying:isBallFlying,height:ballPos.y-100,scale:golferGroup.scale.toArray(),cameraOffset:targetCameraPos.clone().sub(ballPos).toArray(),line:aimLine.visible};
  getTerrainHeight=oldHeight;getTerrainNormal=oldNormal;detectLie=oldLie;
  return result;
 });
 assert.equal(rolled.flying,false);assert.ok(Math.abs(rolled.height-baseline.radius)<1e-8);assert.deepEqual(rolled.scale,baseline.scale);
 assert.ok(Math.abs(Math.hypot(rolled.cameraOffset[0],rolled.cameraOffset[2])-4.2)<1e-8);assert.ok(Math.abs(rolled.cameraOffset[1]-1.35)<1e-8);assert.equal(rolled.line,true);
 console.log('PASS: rolling height equals radius, rest callback uses original address framing');
 // Real putter velocity must also follow the free heading.
 const putt=await page.evaluate(()=>{
  isBallFlying=false;setupHole(1);currentClubIndex=12;updateSelectedClubUI();setAimAngle(-90);
  const direction=aimDirection.clone();executeGolfShot({isPutt:true,carryMultiplier:0,rollMultiplier:.35},direction);
  return {dot:ballVel.clone().setY(0).normalize().dot(direction),vy:ballVel.y};
 });
 assert.ok(putt.dot>.99999);assert.equal(putt.vy,0);
 console.log('PASS: putter free heading');
 // Coincident pin: no NaN and no line crossing the cup.
 const near=await page.evaluate(()=>{
  isBallFlying=false;setupHole(1);ballPos.copy(holePins3D[1]);resetAimToPin();updateAimTracer();
  return {finite:aimDirection.toArray().every(Number.isFinite),visible:aimLine.visible,length:getAimGuideLength()};
 });
 assert.equal(near.finite,true);assert.equal(near.visible,false);assert.equal(near.length,0);
 // Session export/import preserves independently selected heading.
 const restored=await page.evaluate(()=>{
  setupHole(1);setAimAngle(73);setAddressCamera(true);PuttUI.updateShotState(true);
  const snapshot=PuttUI.exportSession();const expected=aimDirection.clone();
  setAimAngle(0);setAddressCamera(true);PuttUI.importSession(snapshot);
  return {error:aimDirection.distanceTo(expected),hasAim:Array.isArray(snapshot.aim)};
 });
 assert.equal(restored.hasAim,true);assert.ok(restored.error<1e-8);
 console.log('PASS: aim session restoration');
 // Small-screen control layout and touch input.
 await page.setViewportSize({width:390,height:844});await page.evaluate(()=>{setupHole(1);PuttUI.sync()});
 await page.evaluate(()=>setAimAngle(-60));
 const layout=await page.evaluate(()=>{
  const d=document.getElementById('bottom-game-dock').getBoundingClientRect();
  return {fits:d.left>=0&&d.right<=innerWidth,separate:!document.getElementById('aim-controls'),visible:aimLine.visible};
 });
 assert.ok(layout.fits);assert.ok(layout.separate);assert.ok(layout.visible);
 await page.waitForFunction(()=>!isCameraTransitioning);
 await page.evaluate(()=>document.getElementById('cache-indicator').hidden=true);
 await page.screenshot({path:'aim-mobile.png'});
 assert.deepEqual(errors,[]);
 fs.writeFileSync('tests/aim-browser-results.json',JSON.stringify({passed:true,baseline,rolled,layout,pageErrors:errors},null,2));
 await browser.close();console.log('PASS: desktop/mobile browser tests, no page errors');
})().catch(e=>{console.error(e);process.exit(1)});
