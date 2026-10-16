const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('fs');
(async()=>{const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[];
for(const [w,h,touch]of [[360,800,true],[390,844,true],[1366,768,false]]){
 const c=await browser.newContext({viewport:{width:w,height:h},isMobile:touch,hasTouch:touch,reducedMotion:'reduce'});const p=await c.newPage();let errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(process.env.GAME_URL||'http://localhost:8080/');await p.waitForFunction(()=>typeof PuttUI!=='undefined'&&proGolferLoaded);
 const click=async selector=>touch?p.locator(selector).tap():p.locator(selector).click();
 for(const skill of ['beginner','mid','low','scratch'])for(const course of ['mis','tehran'])for(const practice of [false,true]){
  if(await p.locator('#game-ui').isVisible()){await click('#btn-open-settings');await click('#return-title');await click('#btn-new-round')}else await click('#btn-splash-enter');
  await click(`[data-skill="${skill}"]`);assert.ok(await p.locator('#course-select-modal').isVisible(),'Skill tap must open course');
  await click(`[data-course="${course}"]`);assert.ok(await p.locator('#mode-select-modal').isVisible(),'Course tap must open game modes');
  if(practice){await click('#btn-mode-custom-hole');await click('.hole-pick-card:nth-child(3)')}else await click('#btn-mode-18holes');
  const state=await p.evaluate(()=>({view:document.body.dataset.view,hole:currentHoleNumber,mode:gameMode,skill:window.currentHandicap,course:window.activeCourseId,canvas:document.querySelector('#canvas-container canvas').width,overlay:document.querySelector('#setup-shell').hidden}));
  assert.equal(state.view,'game');assert.equal(state.hole,practice?3:1);assert.equal(state.mode,practice?'single_hole':'18holes');assert.equal(state.skill,skill);assert.equal(state.course,course);assert.ok(state.overlay&&state.canvas>0);
  results.push({w,h,touch,practice,...state});
 }
 assert.deepEqual(errors,[]);await c.close();
}
fs.mkdirSync('audit',{recursive:true});fs.writeFileSync('audit/start-flow-fix-results.json',JSON.stringify(results,null,2));console.log('PASS',results.length,'start journeys; all skills, both courses, round and practice, 360/390 touch and desktop.');await browser.close()})();
