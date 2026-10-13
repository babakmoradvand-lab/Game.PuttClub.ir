const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert/strict');
(async()=>{
const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});const page=await context.newPage();let errors=[];const results=[],violations=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto('http://localhost:8080/');await page.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded);await page.evaluate(()=>document.fonts.ready);await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
for(const [w,h]of [[360,800],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080],[2560,1440],[3440,1440],[800,360],[844,390]]){
await page.setViewportSize({width:w,height:h});
for(const screen of ['title','handicap','course','mode','holes']){
if(screen==='handicap')await page.click('#btn-splash-enter');
if(screen==='course')await page.click('#skill-continue');
if(screen==='mode')await page.click('#course-continue');
if(screen==='holes')await page.click('#btn-mode-custom-hole');
const metrics=await page.evaluate(screen=>{
const root=screen==='title'?document.querySelector('#putt-club-splash'):document.querySelector('#setup-shell');
const controls=[...root.querySelectorAll('button')].filter(e=>e.getClientRects().length);
const horizontal=controls.filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5}).map(e=>e.id||e.className);
return {horizontal,scrollWidth:root.scrollWidth,clientWidth:root.clientWidth,overflowX:getComputedStyle(root).overflowX,documentWidth:document.documentElement.scrollWidth,minTouchHeight:Math.min(...controls.map(e=>e.getBoundingClientRect().height))};
},screen);
assert.ok(!metrics.horizontal.length,`${screen} horizontal clip at ${w}x${h}: ${metrics.horizontal}`);assert.ok(metrics.documentWidth<=w+1&&(metrics.overflowX==='hidden'||metrics.scrollWidth<=metrics.clientWidth+1),`${screen} overflow at ${w}x${h}`);
results.push({w,h,screen,...metrics});
if(w===390||w===1366){
await page.screenshot({path:`screenshots/after/${w===390?'mobile-':''}${screen==='title'?'main-menu':screen==='holes'?'practice':screen}.png`,animations:'disabled'});
const axe=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}));violations.push({w,h,screen,violations:axe.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))});
}
}
await page.click('#setup-close');
}
fs.writeFileSync('audit/setup-layout-results.json',JSON.stringify({results,errors,violations},null,2));console.log({cases:results.length,errors,violations:violations.filter(x=>x.violations.length)});
// Dedicated touch journey (actual synthesized touchscreen taps, not mouse clicks).
const touch=await browser.newContext({hasTouch:true,isMobile:true,viewport:{width:390,height:844},deviceScaleFactor:2,reducedMotion:'reduce'});
const t=await touch.newPage();t.on('pageerror',e=>errors.push(e.message));await t.goto('http://localhost:8080/');await t.waitForFunction(()=>typeof PuttUI!=='undefined');
await t.tap('#btn-splash-enter');await t.tap('[data-skill="mid"]');await t.tap('#skill-continue');await t.tap('#course-continue');await t.tap('#btn-mode-custom-hole');await t.locator('.hole-pick-card').nth(4).tap();
await t.tap('#club-trigger-card');await t.locator('[data-club-index="0"]').tap();await t.tap('#swing-trigger-card');await t.tap('[data-mode="half"]');await t.tap('#btn-close-swing-picker');
assert.ok(await t.evaluate(()=>currentHoleNumber===5&&currentClubIndex===0&&currentSwingMode==='half'&&gameMode==='single_hole'));
await t.tap('#minimap-container');await t.tap('#btn-open-scorecard');await t.tap('#btn-menu-close');
await t.tap('#swing-trigger-card');await t.locator('#swing-power-slider').focus();await t.keyboard.press('Home');assert.ok(await t.evaluate(()=>currentSwingMode==='chip'));await t.keyboard.press('End');assert.ok(await t.evaluate(()=>currentSwingMode==='full'));await t.keyboard.press('Escape');
await t.tap('#btn-launch-shot');assert.ok(await t.evaluate(()=>golferSwingPhase==='backswing'&&!isBallFlying));
console.log('PASS touch journey / practice / club / stroke / map / scorecard / keyboard slider / impact hold');
fs.writeFileSync('audit/touch-results.json',JSON.stringify({pass:true,errors},null,2));
await browser.close();})();
