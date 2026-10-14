// End-to-end atomic upgrade from aim15 to aim15, followed by an offline launch.
const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const fixture=path.resolve('upgrade-fixture');
const changed=['game.js','ui.js','ui.css','index.html','release.json','golfer-rig.js'];
const manifest=JSON.parse(fs.readFileSync('release.json'));
fs.mkdirSync(fixture,{recursive:true});
for(const a of manifest.assets.concat([{url:'./sw.js'},{url:'./release.json'},{url:'./fonts/Inter.css'},{url:'./fonts/Vazirmatn.css'}])) {
 const name=a.url.slice(2),dest=path.join(fixture,name);fs.mkdirSync(path.dirname(dest),{recursive:true});
 if(fs.existsSync(dest))fs.unlinkSync(dest);
 fs.copyFileSync(changed.includes(name)?path.join('tests/fixtures/aim15-upgrade',name):name,dest);
}
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce',hasTouch:true,isMobile:true});
 const page=await context.newPage();page.setDefaultTimeout(90000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://localhost:8080/upgrade-fixture/');
 await page.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&window.PuttBoot?.ready&&document.getElementById('runtime-boot').hidden);
 assert.equal(await page.evaluate(()=>PuttBoot.version),'aim15-20261014');
 await page.click('#btn-splash-enter');await page.click('#skill-continue');await page.click('#course-continue');await page.click('#btn-mode-18holes');
 const old=await page.evaluate(()=>{
  strokesCurrentHole=2;ballPos.x+=30;ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+.58;ballMesh.position.copy(ballPos);handleBallCameToRest();
  isCameraTransitioning=false;camera.position.copy(targetCameraPos);orbitControls.target.copy(targetOrbitTarget);orbitControls.update();
  return {x:ballPos.x,z:ballPos.z,hole:currentHoleNumber,strokes:strokesCurrentHole};
 });
 for(const name of changed)fs.copyFileSync(name,path.join(fixture,name));
 await page.evaluate(()=>{PuttBoot.check()});
 await page.waitForFunction(()=>window.PuttBoot?.version==='look16-20261014'&&window.PuttUI&&proGolferLoaded&&document.getElementById('runtime-boot').hidden);
 const next=await page.evaluate(()=>({x:ballPos.x,z:ballPos.z,hole:currentHoleNumber,strokes:strokesCurrentHole,height:ballPos.y-getTerrainHeight(ballPos.x,ballPos.z),distance:Math.hypot(camera.position.x-ballPos.x,camera.position.z-ballPos.z),expected:4.2*Math.max(1,.8/camera.aspect),installed:PuttBoot.version,controls:!!document.getElementById('aim-angle-slider')}));
 for(const key of ['x','z','hole','strokes'])assert.equal(next[key],old[key]);
 assert.ok(Math.abs(next.height-.021335)<1e-8);assert.ok(Math.abs(next.distance-next.expected)<1e-8);assert.equal(next.controls,true);
 console.log('PASS: old cached aim15 upgrades atomically to look16; round preserved; legacy floating ball and wide camera corrected');
 await page.locator('#aim-angle-slider').fill('120');await page.waitForFunction(()=>!isCameraTransitioning);
 await context.setOffline(true);await page.reload();
 await page.waitForFunction(()=>window.PuttBoot?.ready&&window.PuttUI&&proGolferLoaded&&document.getElementById('runtime-boot').hidden);
 assert.equal(await page.evaluate(()=>PuttBoot.version),'look16-20261014');
 await page.click('#btn-splash-enter');await page.click('#skill-continue');await page.click('#course-continue');await page.click('#btn-mode-18holes');
 await page.locator('#aim-angle-slider').fill('-90');
 const offline=await page.evaluate(()=>({version:PuttBoot.version,status:PuttBoot.status,visible:aimLine.visible,slider:Number(document.getElementById('aim-angle-slider').value),loaded:proGolferLoaded}));
 assert.equal(offline.status,'offline');assert.equal(offline.visible,true);assert.equal(offline.slider,-90);assert.equal(offline.loaded,true);
 assert.deepEqual(errors,[]);
 fs.writeFileSync('tests/aim-upgrade-results.json',JSON.stringify({passed:true,old,next,offline,pageErrors:errors,environment:'Headless Chromium / SwiftShader, mobile touch emulation (not physical iPhone)'},null,2));
 console.log('PASS: full offline reload with corrected golfer/ball/aim and no page errors');
 } finally {await browser.close();fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
