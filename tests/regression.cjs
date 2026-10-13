const {chromium}=require('playwright');const fs=require('fs');const assert=require('assert/strict');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:1366,height:768},reducedMotion:'reduce'});
 const page=await context.newPage();const errors=[],failed=[],badHTTP=[],checks=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('requestfailed',r=>failed.push({url:r.url(),error:r.failure().errorText}));page.on('response',r=>{if(r.status()>=400)badHTTP.push([r.url(),r.status()])});
 const ok=(name,value)=>{assert.ok(value,name);checks.push({name,pass:true})};
 await page.goto('http://localhost:8080/');await page.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded);
 await page.click('#btn-splash-enter');
 for(const skill of ['beginner','mid','low','scratch']){await page.click(`[data-skill="${skill}"]`);ok('skill '+skill,await page.locator(`[data-skill="${skill}"]`).getAttribute('aria-pressed')==='true')}
 await page.click('#skill-continue');await page.click('[data-course="tehran"]');await page.click('#course-continue');
 await page.click('#setup-back');ok('setup back returns to course',await page.locator('#course-select-modal').isVisible());
 await page.click('#course-continue');await page.click('#btn-mode-custom-hole');
 ok('practice grid has 18 real holes',await page.locator('.hole-pick-card').count()===18);
 await page.locator('.hole-pick-card').nth(2).click();
 ok('practice mode engine and UI consistent',await page.evaluate(()=>gameMode==='single_hole'&&currentHoleNumber===3&&window.activeCourseId==='tehran'&&!brownsGroup.visible));
 await page.click('#btn-open-settings');await page.click('#audio-setting');ok('audio controls actual engine',await page.evaluate(()=>AudioEngine.muted));await page.click('#audio-setting');
 await page.locator('#quality-select').selectOption('low');ok('performance settings',await page.evaluate(()=>renderer.getPixelRatio()<=1&&!renderer.shadowMap.enabled));await page.locator('#quality-select').selectOption('auto');
 await page.click('#motion-setting');ok('reduced-motion toggle',await page.evaluate(()=>document.body.dataset.reducedMotion==='false'));await page.click('#motion-setting');
 const before=await page.evaluate(()=>({ball:ballPos.toArray(),hole:currentHoleNumber,strokes:strokesCurrentHole}));
 await page.click('#return-title');await page.click('#btn-splash-enter');
 ok('title resume preserves game',JSON.stringify(before)===JSON.stringify(await page.evaluate(()=>({ball:ballPos.toArray(),hole:currentHoleNumber,strokes:strokesCurrentHole}))));
 // Return for a full-round MIS journey.
 await page.click('#btn-open-settings');await page.click('#return-title');await page.click('#btn-new-round');await page.click('#skill-continue');await page.click('[data-course="mis"]');await page.click('#course-continue');await page.click('#btn-mode-18holes');
 ok('full-round mode',await page.evaluate(()=>gameMode==='18holes'&&currentHoleNumber===1&&brownsGroup.visible));
 // Every club selected through its actual button.
 for(let n=0;n<13;n++){await page.click('#club-trigger-card');await page.locator(`[data-club-index="${n}"]`).click();ok('club '+n,await page.evaluate(n=>currentClubIndex===n,n))}
 await page.locator('#putter-backswing-slider').fill('66');ok('putter feedback',await page.locator('#swing-badge-label').textContent()==='66%');
 await page.click('#club-trigger-card');await page.locator('[data-club-index="6"]').click();
 await page.click('#swing-trigger-card');
 for(const mode of ['full','three-quarter','half','chip']){await page.click(`[data-mode="${mode}"]`);ok('swing '+mode,await page.evaluate(m=>currentSwingMode===m,mode))}
 await page.locator('#swing-power-slider').fill('2');ok('power slider maps to real 3/4 preset',await page.evaluate(()=>currentSwingMode==='three-quarter'));
 await page.keyboard.press('Escape');ok('Escape closes overlay and restores focus',await page.evaluate(()=>document.querySelector('#swing-picker-modal').hidden&&document.activeElement.id==='swing-trigger-card'));
 await page.click('#btn-open-scorecard');await page.evaluate(()=>PuttUI.openPanel('settings-panel'));ok('one panel visible',await page.evaluate(()=>document.querySelectorAll('.game-panel:not([hidden])').length===1));
 // Tab focus remains inside the active dialog.
 await page.locator('#return-title').focus();await page.keyboard.press('Tab');ok('focus trap wraps',await page.evaluate(()=>document.activeElement.closest('.game-panel')?.id==='settings-panel'));
 await page.keyboard.press('Escape');
 // Capture game screenshots with zero fixture scores before synthetic tests.
 await page.screenshot({path:'screenshots/after/gameplay.png',animations:'disabled'});
 await page.click('#club-trigger-card');await page.screenshot({path:'screenshots/after/club-selector.png',animations:'disabled'});await page.keyboard.press('Escape');
 await page.click('#btn-open-scorecard');await page.screenshot({path:'screenshots/after/scorecard.png',animations:'disabled'});await page.keyboard.press('Escape');
 // Deterministic animation stepping: exercises actual shot callbacks, not mock UI.
 for(const mode of ['full','three-quarter','half','chip','putt']){
  await page.evaluate(m=>{isBallFlying=false;setupHole(1);currentClubIndex=m==='putt'?12:6;currentSwingMode=m==='putt'?'full':m;updateSelectedClubUI();PuttUI.sync()},mode);
  await page.click(mode==='putt'?'#btn-putt-action':'#btn-launch-shot');
  ok('pre-impact ball held '+mode,await page.evaluate(()=>!isBallFlying&&golferSwingPhase==='backswing'));
  const actual=await page.evaluate(()=>{
   for(let n=0;n<180;n++)updateGolferAnimation(1/120);
   const launched={strokes:strokesCurrentHole,flying:isBallFlying,velocity:ballVel.length()};
   for(let n=0;n<3000&&isBallFlying;n++)stepPhysics(1/60);
   return {...launched,postPhysics:ballPos.toArray().every(Number.isFinite),settled:!isBallFlying,telemetry:document.querySelector('#tele-total').textContent};
  });
  ok('one impact launches '+mode,actual.strokes===1&&actual.flying&&actual.velocity>0);ok('finite ball trajectory '+mode,actual.postPhysics);
  checks.push({name:'shot outcome '+mode,...actual});
 }
 // Cup capture fixture: use real collision detection and real scoring.
 const capture=async(mode,hole,strokes)=>{
  await page.evaluate(({mode,hole,strokes})=>{
   isBallFlying=false;setupHole(hole);gameMode=mode;currentClubIndex=12;strokesCurrentHole=strokes;
   ballPos.copy(holePins3D[hole]);ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+.58;
   ballVel.set(.1,0,.1);isBallGrounded=true;isBallFlying=true;isBallSettled=false;stepPhysics(1/60);
  },{mode,hole,strokes});
 };
 await capture('single_hole',3,2);ok('cup collision stores practice score',await page.evaluate(()=>holeScores[3]===2&&getComputedStyle(document.querySelector('#celebration-overlay')).display!=='none'));
 await page.click('#btn-celeb-next');ok('practice replay same hole',await page.evaluate(()=>currentHoleNumber===3&&strokesCurrentHole===0));
 await capture('18holes',1,3);await page.click('#btn-celeb-next');ok('full round advances hole',await page.evaluate(()=>currentHoleNumber===2));
 await capture('18holes',18,4);await page.click('#btn-celeb-next');ok('final hole opens scorecard',await page.locator('#menu-modal').isVisible());
 const scoreCheck=await page.evaluate(()=>{
  // Known fixtures, not player data. Verify aggregate and semantic result rendering.
  holeScores.fill(null);holeScores[1]=3;holeScores[2]=4;holeScores[3]=4;renderScorecardTable();
  return {rows:document.querySelectorAll('#scorecard-body tr').length,summary:document.querySelector('#score-summary').textContent,results:[...document.querySelectorAll('.score-result')].slice(0,3).map(e=>e.textContent)};
 });ok('scorecard formula fixture',scoreCheck.rows===18&&scoreCheck.summary.includes('11')&&scoreCheck.results[0]==='Birdie');
 await page.keyboard.press('Escape');
 // Remove fixtures before responsive captures and offline tests.
 await page.evaluate(()=>{holeScores.fill(null);isBallFlying=false;gameMode='18holes';setupHole(1);PuttUI.sync()});
 await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
 const axe=await page.evaluate(async()=>await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa']}}));
 fs.writeFileSync('audit/accessibility-game.json',JSON.stringify(axe.violations.map(v=>({id:v.id,impact:v.impact,description:v.description,nodes:v.nodes.map(n=>n.target)})),null,2));
 // Bounding / ball clearance at requested viewports, plus landscape and ultrawide.
 const sizes=[[360,800],[390,844],[430,932],[768,1024],[1024,768],[1366,768],[1920,1080],[2560,1440],[3440,1440],[800,360],[844,390]];
 const layouts=[];
 for(const [w,h]of sizes){
  await page.setViewportSize({width:w,height:h});await page.evaluate(()=>{handleResize();setupHole(1)});
  const geometry=await page.evaluate(()=>{
   const dock=document.querySelector('#bottom-game-dock').getBoundingClientRect();
   const screen=ballPos.clone().project(camera);const ball={x:(screen.x*.5+.5)*innerWidth,y:(-screen.y*.5+.5)*innerHeight};
   const overlap=ball.x>dock.left&&ball.x<dock.right&&ball.y>dock.top&&ball.y<dock.bottom;
   const bounds=[...document.querySelectorAll('#game-ui button,#game-ui input')].filter(e=>e.getClientRects().length).map(e=>{const b=e.getBoundingClientRect();return{id:e.id,x:b.x,y:b.y,w:b.width,h:b.height}});
   return {scroll:document.documentElement.scrollWidth>innerWidth,ball,dock:{top:dock.top,bottom:dock.bottom},overlap,clipped:bounds.filter(b=>b.x<0||b.x+b.w>innerWidth+1||b.y<0||b.y+b.h>innerHeight+1)};
  });ok(`game layout ${w}x${h}`,!geometry.scroll&&!geometry.overlap&&!geometry.clipped.length&&geometry.ball.x>0&&geometry.ball.x<w&&geometry.ball.y>0&&geometry.ball.y<h);
  // Panels remain within viewport and essential table columns fit.
  for(const panelId of ['club-picker-modal','swing-picker-modal','menu-modal','settings-panel']){
   await page.evaluate(id=>PuttUI.openPanel(id),panelId);
   const inside=await page.locator('#'+panelId).evaluate(el=>{const b=el.getBoundingClientRect();return b.x>=0&&b.y>=0&&b.right<=innerWidth+1&&b.bottom<=innerHeight+1});ok(`${panelId} ${w}x${h}`,inside);await page.keyboard.press('Escape');
  }
  if(w===390){await page.screenshot({path:'screenshots/after/mobile-gameplay.png',animations:'disabled'});await page.click('#btn-open-scorecard');await page.screenshot({path:'screenshots/after/mobile-scorecard.png',animations:'disabled'});await page.keyboard.press('Escape')}
  layouts.push({w,h,...geometry});
 }
 // Offline: wait for install, check all precached core assets, reload with no network.
 await page.waitForFunction(()=>document.querySelector('#offline-state').textContent.startsWith('All '),{timeout:60000});
 const offlineText=await page.locator('#offline-state').textContent();await context.setOffline(true);await page.reload({waitUntil:'load'});await page.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded);
 await page.click('#btn-splash-enter');await page.click('#skill-continue');await page.click('#course-continue');await page.click('#btn-mode-18holes');
 ok('offline game and GLB reload',await page.evaluate(()=>proGolferLoaded&&document.body.dataset.view==='game'&&document.querySelectorAll('.club-btn').length===13));await context.setOffline(false);
 fs.writeFileSync('audit/regression-results.json',JSON.stringify({checks,layouts,errors,failed,badHTTP,offlineText,axeViolations:axe.violations.length,environment:'Chromium headless / SwiftShader software WebGL, not real mobile hardware'},null,2));
 console.log(JSON.stringify({checks:checks.length,errors,failed,badHTTP,offlineText,axe:axe.violations.map(v=>v.id)},null,2));
 await browser.close();
})();
