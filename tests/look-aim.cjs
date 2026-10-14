const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const errors=[],shaderErrors=[],checks=[];
 try {
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 const page=await context.newPage();page.setDefaultTimeout(90000);
 async function boot(p) {
  p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')shaderErrors.push(m.text())});
  await p.goto('http://localhost:8080/');
  await p.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&window.PuttBoot?.ready&&document.getElementById('runtime-boot').hidden);
  await p.click('#btn-splash-enter');await p.click('#skill-continue');await p.click('#course-continue');await p.click('#btn-mode-18holes');
 }
 function check(name,value){assert.ok(value,name);checks.push(name);console.log('PASS:',name)}
 await boot(page);
 check('separate rotation controls removed from desktop',await page.evaluate(()=>!document.getElementById('aim-controls')&&!document.getElementById('aim-angle-slider')));
 check('look17 loaded',await page.evaluate(()=>PuttBoot.version==='look17-20261014'));
 const before=await page.evaluate(()=>aimDirection.toArray());
 await page.mouse.move(980,400);await page.mouse.down();await page.mouse.move(1180,400,{steps:8});await page.mouse.up();
 const mouse=await page.evaluate(()=>{
  const cameraDir=camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize();
  const lead=new THREE.Vector3(1,0,0).applyQuaternion(golferGroup.quaternion);
  const yaw=THREE.MathUtils.radToDeg(Math.atan2(aimDirection.x,aimDirection.z)-aimBaseYaw);
  return {direction:aimDirection.toArray(),cameraDot:cameraDir.dot(aimDirection),leadDot:lead.dot(aimDirection),yaw,visible:aimLine.visible,width:aimLineMat.uniforms.width.value,drawCount:aimRibbonGeo.drawRange.count};
 });
 check('real mouse drag changes direction',new (require('../three.min.js').Vector3)().fromArray(before).distanceTo(new (require('../three.min.js').Vector3)().fromArray(mouse.direction))>.2);
 check('view, athlete and aim are aligned',mouse.cameraDot>.999999&&mouse.leadDot>.999999);
 check('thin WebGL guide is a 2px triangle ribbon',mouse.width===2&&mouse.drawCount>0&&mouse.visible);
 const releaseHeading=mouse.direction;
 await page.waitForTimeout(300);
 check('no aim inertia after releasing pointer',await page.evaluate(v=>aimDirection.distanceTo(new THREE.Vector3().fromArray(v))<1e-9,releaseHeading));
 const guides=await page.evaluate(()=>{
  const oldWind=windSpeedMph;windSpeedMph=0;
  const rows=[];
  for(const club of [0,6,11,12]) {
   setupHole(1);currentClubIndex=club;currentSwingMode='full';setAimAngle(20,true);updateSelectedClubUI();
   const pts=getAimGuidePoints();const last=pts[pts.length-1];
   rows.push({club,cap:getAimGuideLength(),distance:Math.hypot(last.x-ballPos.x,last.z-ballPos.z),above:Math.max(...pts.map(p=>p.y-ballPos.y)),groundError:club===12?Math.max(...pts.map(p=>Math.abs(p.y-getAimSurfaceHeight(p.x,p.z)-.03))):null,finite:pts.every(p=>p.toArray().every(Number.isFinite)),meshDraw:aimRibbonGeo.drawRange.count});
  }
  windSpeedMph=oldWind;setupHole(1);return rows;
 });
 for(const g of guides){
  check('guide finite and within cap, club '+g.club,g.finite&&g.distance<=g.cap+.0001);
  if(g.club===12)check('putt stays on ground and ends at two yards',Math.abs(g.cap-1.8288)<1e-8&&Math.abs(g.distance-1.8288)<1e-6&&g.groundError<1e-8);
  else check('non-putt shows a rising flight arc up to 30 yards, club '+g.club,Math.abs(g.cap-27.432)<1e-8&&g.above>.2);
 }
 // Independent integration comparison: preview points are the real air-step samples.
 const matched=await page.evaluate(()=>{
  setupHole(1);currentClubIndex=0;currentSwingMode='full';setAimAngle(35,true);
  const pts=getAimGuidePoints(),pos=ballPos.clone();pos.y+=.05;
  const vel=getShotLaunchVelocity(calculateShotSpecs(currentClubIndex,currentSwingMode));
  let maxError=0;
  for(let sample=1;sample<pts.length-1;sample++) {
   for(let i=0;i<4;i++)stepBallFlight(pos,vel,1/120,true);
   maxError=Math.max(maxError,pos.distanceTo(pts[sample]));
  }
  return {maxError,points:pts.length};
 });
 check('preview samples use exactly the physical flight integrator',matched.maxError<1e-9&&matched.points>2);
 await page.screenshot({path:'look17-desktop.png'});
 // Launch by real button, then try dragging: direction is frozen from backswing.
 const launchDir=await page.evaluate(()=>aimDirection.toArray());await page.click('#btn-launch-shot');
 await page.mouse.move(980,400);await page.mouse.down();await page.mouse.move(1120,400,{steps:4});await page.mouse.up();
 check('drag cannot change direction during swing',await page.evaluate(v=>aimDirection.distanceTo(new THREE.Vector3().fromArray(v))<1e-9&&!aimLine.visible,launchDir));
 await page.waitForFunction(()=>isBallFlying);
 check('actual launch follows the dragged direction',await page.evaluate(v=>ballVel.clone().setY(0).normalize().dot(new THREE.Vector3().fromArray(v))>.98,launchDir));
 await context.close();
 // Real touch events, not synthetic JS dispatched events.
 const touchContext=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'});
 const mobile=await touchContext.newPage();mobile.setDefaultTimeout(90000);await boot(mobile);
 const initial=await mobile.evaluate(()=>aimDirection.toArray());const cdp=await touchContext.newCDPSession(mobile);
 await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:280,y:420,id:0}]});
 for(const x of [260,240,220,200])await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x,y:420,id:0}]});
 await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
 const touch=await mobile.evaluate(v=>({changed:aimDirection.distanceTo(new THREE.Vector3().fromArray(v)),dot:camera.getWorldDirection(new THREE.Vector3()).setY(0).normalize().dot(aimDirection),pointerCleared:lookAimPointer===null,visible:aimLine.visible}),initial);
 check('real one-finger mobile drag rotates both look and aim',touch.changed>.2&&touch.dot>.999999&&touch.pointerCleared&&touch.visible);
 await mobile.screenshot({path:'look17-mobile.png'});
 // Putting view uses the shorter, ground-only ribbon.
 await mobile.evaluate(()=>{currentClubIndex=12;currentSwingMode='full';updateSelectedClubUI();setAddressCamera(true)});
 await mobile.screenshot({path:'look17-putt.png'});
 check('separate rotation controls removed from mobile',await mobile.evaluate(()=>!document.getElementById('aim-controls')&&!document.getElementById('aim-angle-slider')));
 check('mobile putter mode is ground-only',await mobile.evaluate(()=>Math.abs(getAimGuideLength()-1.8288)<1e-9&&aimLineMat.uniforms.dash.value===.18));
 check('no page or shader errors',errors.length===0&&shaderErrors.length===0);
 fs.writeFileSync('tests/look-aim-results.json',JSON.stringify({passed:true,version:'look17-20261014',checks,mouse,guides,matched,touch,pageErrors:errors,shaderErrors,environment:'Chromium headless / SwiftShader; real mouse and CDP touch events, not a physical device'},null,2));
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
