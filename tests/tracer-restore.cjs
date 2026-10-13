const {chromium}=require('playwright');const assert=require('node:assert/strict'),fs=require('fs');
(async()=>{
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[],errors=[],shaderErrors=[];
for(const [w,h]of [[390,844],[1366,768]]){
 const page=await browser.newPage({viewport:{width:w,height:h},reducedMotion:'reduce'});
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')shaderErrors.push(m.text())});
 await page.goto(process.env.GAME_URL||'http://localhost:8080/');await page.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded);
 await page.click('#btn-splash-enter');await page.click('[data-skill="scratch"]');await page.click('[data-course="mis"]');await page.click('#btn-mode-18holes');await page.click('#btn-launch-shot');
 const data=await page.evaluate(()=>{
  for(let i=0;i<180;i++)updateGolferAnimation(1/120);
  for(let i=0;i<240;i++)stepPhysics(1/120);
  // Freeze this genuine shot for an inspectable test capture; no fixture distance.
  isBallFlying=false;camera.position.set(shotStartPos.x,shotStartPos.y+3,shotStartPos.z);
  const pin=holePins3D[currentHoleNumber];const d=pin.clone().sub(shotStartPos).setY(0).normalize();camera.position.addScaledVector(d,-6);
  orbitControls.target.copy(shotStartPos).addScaledVector(d,100);orbitControls.target.y=shotStartPos.y+12;orbitControls.update();
  updateToptracerYardageTag(ballPos);renderer.render(scene,camera);
  const tag=document.querySelector('#toptracer-yardage-tag'),style=getComputedStyle(tag),label=getComputedStyle(tag.querySelector('.tracer-label')),value=getComputedStyle(tag.querySelector('.tracer-val'));
  const p=ballPos.clone().project(camera);
  return {w:innerWidth,h:innerHeight,display:style.display,background:style.backgroundColor,border:style.borderTopWidth,direction:style.flexDirection,transform:style.transform,labelSize:label.fontSize,valueSize:value.fontSize,color:value.color,tagX:parseFloat(tag.style.left),tagY:parseFloat(tag.style.top),expectedX:(p.x*.5+.5)*innerWidth,expectedY:(-p.y*.5+.5)*innerHeight,yards:Number(tag.querySelector('.tracer-val').textContent),expectedYards:Math.round(new THREE.Vector2(ballPos.x-shotStartPos.x,ballPos.z-shotStartPos.z).length()*1.09361),points:ribbonHistory.length,drawCount:tracerGeo.drawRange.count,glowMaterialRestored:tracerMat.onBeforeCompile===legacyTracerColorOutput};
 });
 assert.equal(data.display,'flex');assert.equal(data.background,'rgba(0, 0, 0, 0)');assert.equal(data.border,'0px');assert.equal(data.direction,'column');assert.equal(data.labelSize,'11px');assert.equal(data.valueSize,'30px');assert.equal(data.color,'rgb(255, 255, 255)');assert.equal(data.yards,data.expectedYards);assert.ok(Math.abs(data.tagX-data.expectedX)<.001&&Math.abs(data.tagY-data.expectedY)<.001);assert.ok(data.points>2&&data.drawCount>0&&data.glowMaterialRestored);
 results.push(data);await page.screenshot({path:`audit/tracer-restored-${w}.png`,animations:'disabled'});await page.close();
}
assert.deepEqual(errors,[]);assert.deepEqual(shaderErrors,[]);fs.writeFileSync('audit/tracer-restore-results.json',JSON.stringify({results,errors,shaderErrors},null,2));console.log(JSON.stringify({results,errors,shaderErrors},null,2));await browser.close();})();
