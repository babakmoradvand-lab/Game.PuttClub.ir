/* Real Service Worker + CacheStorage tests. Release mutations are isolated in an
   in-memory HTTP fixture; no production files or physics values are rewritten. */
const {chromium}=require('playwright'),http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=path.resolve(fs.existsSync('public/index.html')?'public':'.'), base=JSON.parse(fs.readFileSync(path.join(root,'release.json')));
const files=new Map(base.assets.map(a=>[a.url.slice(2),fs.readFileSync(path.join(root,a.url.slice(2)))]));
const fixtureRoot=fs.existsSync('audit/pwa9/index-before.html')?'audit/pwa9':path.join(root,'tests/fixtures/pwa8');
const legacyFiles=new Map(files);
for(const [name,backup] of [['index.html','index-before.html'],['game.js','game-before.js'],['ui.js','ui-before.js'],['sw.js','sw-before.js']])legacyFiles.set(name,fs.readFileSync(path.join(fixtureRoot,backup)));
const nextFiles=new Map(files);
nextFiles.set('index.html',Buffer.from(files.get('index.html').toString().replace('content="pwa9-20261013"','content="pwa9-test-update"')));
nextFiles.set('presentation.css',Buffer.concat([files.get('presentation.css'),Buffer.from('\n/* isolated update fixture */\n')]));
const next={version:'pwa9-test-update',createdAt:new Date(Date.parse(base.createdAt)+60000).toISOString(),assets:[...nextFiles].map(([p,b])=>({url:'./'+p,bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')}))};
let mode='base', requests=[];
const types={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json',png:'image/png',jpg:'image/jpeg',ttf:'font/ttf',glb:'model/gltf-binary',webp:'image/webp'};
const server=http.createServer((req,res)=>{
 const url=new URL(req.url,'http://localhost:8081');let name=decodeURIComponent(url.pathname).replace(/^\/Game.PuttClub.ir\//,'/').slice(1)||'index.html';
 requests.push({name,release:url.searchParams.get('__release')});
 let bytes;
 if(name==='release.json')bytes=Buffer.from(JSON.stringify(mode==='base'||mode==='first-failure'?base:next));
 else if(name==='presentation.css'&&mode==='first-failure'){res.writeHead(503);res.end('Fixture: interrupted initial download');return;}
 else if(name==='presentation.css'&&mode==='bad-update'&&url.searchParams.has('__release'))bytes=Buffer.from('Fixture: wrong asset digest');
 else bytes=(mode==='legacy'?legacyFiles:mode==='base'||mode==='first-failure'?files:nextFiles).get(name);
 if(!bytes){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-store'});res.end(bytes);
});
const results=[];
const record=(name,data={})=>{results.push({name,pass:true,...data});console.log('PASS',name,JSON.stringify(data));};
(async()=>{
 fs.mkdirSync('audit/pwa9',{recursive:true});
 await new Promise(resolve=>server.listen(8081,'0.0.0.0',resolve));
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try {
 const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});let p=await ctx.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));
 const ready=async()=>{await p.waitForFunction(()=>window.PuttUI&&window.PuttBoot?.ready&&document.querySelector('#runtime-boot').hidden,{timeout:60000});await p.waitForFunction(()=>proGolferLoaded,{timeout:60000});};
 // A failed first install may not expose the title or execute the engine.
 mode='first-failure';await p.goto('http://localhost:8081/');await p.locator('#boot-retry').waitFor({state:'visible',timeout:60000});
 assert.equal(await p.evaluate(()=>typeof PuttUI),'undefined');assert.equal(await p.locator('#canvas-container canvas').count(),0);
 assert.equal(await p.evaluate(async()=>{const keys=await caches.keys();return keys.filter(k=>k.startsWith('puttclub-runtime:')).length}),0);
 record('failed initial asset: no engine, no partially committed cache');
 mode='base';await p.click('#boot-retry');await ready();
 const verified=await p.evaluate(async()=>{
  const state=await PuttBoot.rpc('STATUS'),cache=await caches.open(state.cache);let bytes=0;
  for(const a of state.manifest.assets){const r=await cache.match(new URL(a.url,location.href));if(!r)throw Error(a.url);const data=await r.arrayBuffer();bytes+=data.byteLength;const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(n=>n.toString(16).padStart(2,'0')).join('');if(sha!==a.sha256)throw Error('Hash: '+a.url);}
  return {assets:state.manifest.assets.length,bytes,version:state.manifest.version};
 });assert.equal(verified.assets,47);record('all offline assets independently verified by SHA-256',verified);
 // Every unchanged reopening should fetch only small update-check files.
 requests=[];await p.reload();await ready();const warm=[...requests];assert.ok(warm.every(r=>['release.json','sw.js'].includes(r.name)),JSON.stringify(warm));
 record('unchanged online launch: zero game asset network downloads',{network:warm});
 // Corrupted update must be discarded, keeping the complete prior release.
 mode='bad-update';await p.reload();await ready();const rejected=await p.evaluate(async()=>({boot:PuttBoot.status,version:PuttBoot.version,cache:(await PuttBoot.rpc('STATUS')).manifest.version,keys:await caches.keys()}));
 assert.equal(rejected.boot,'update-unavailable');assert.equal(rejected.cache,base.version);assert.ok(!rejected.keys.some(k=>k.endsWith(next.version)));
 record('failed update integrity: previous complete game preserved',rejected);
 // Cold offline reopening, then actual one-tap start and shot animation/physics.
 mode='base';await ctx.setOffline(true);await p.close();p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));await p.goto('http://localhost:8081/index.html');await ready();assert.equal(await p.evaluate(()=>PuttBoot.status),'offline');
 await p.tap('#btn-splash-enter');await p.tap('[data-skill="scratch"]');await p.tap('[data-course="tehran"]');await p.tap('#btn-mode-custom-hole');await p.tap('.hole-pick-card:nth-child(3)');await p.tap('#btn-launch-shot');
 const shot=await p.evaluate(()=>{for(let n=0;n<180;n++)updateGolferAnimation(1/120);for(let n=0;n<120;n++)stepPhysics(1/120);return {hole:currentHoleNumber,course:activeCourseId,strokes:strokesCurrentHole,flying:isBallFlying,finite:ballPos.toArray().every(Number.isFinite),tracer:ribbonHistory.length};});
 assert.ok(shot.hole===3&&shot.course==='tehran'&&shot.strokes===1&&shot.flying&&shot.finite&&shot.tracer>1);record('cold offline home-screen URL: course selection + genuine shot',shot);
 await ctx.setOffline(false);
 // Preserve a real engine-state checkpoint through a foreground update.
 await p.evaluate(()=>{isBallFlying=false;golferSwingPhase='idle';setupHole(3);strokesCurrentHole=2;holeScores[1]=3;ballPos.x+=9;ballMesh.position.copy(ballPos);currentClubIndex=6;currentSwingMode='half';updateHoleUI();PuttUI.sync();});
 const before=await p.evaluate(()=>PuttUI.exportSession());mode='update';requests=[];
 await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForFunction(()=>window.PuttBoot?.version==='pwa9-test-update'&&window.PuttUI&&document.querySelector('#runtime-boot').hidden,{timeout:60000});await ready();
 const after=await p.evaluate(()=>PuttUI.exportSession());for(const key of ['started','view','skill','course','mode','hole','single','strokes','tee','scores','club','swing','ball','camera','target','putt'])assert.deepEqual(after[key],before[key],key);
 const installed=await p.evaluate(()=>PuttBoot.rpc('STATUS'));assert.equal(installed.downloaded,2);assert.equal(installed.reused,45);
 record('foreground update: hash reuse, consistent reload, round restored',{downloaded:installed.downloaded,reused:installed.reused,strokes:after.strokes,hole:after.hole});
 const controls=await p.evaluate(()=>({map:document.querySelector('#minimap-canvas').getBoundingClientRect().height,glass:getComputedStyle(document.querySelector('#bottom-game-dock')).backdropFilter}));assert.equal(controls.map,0);assert.ok(controls.glass.includes('blur'));
 await p.tap('#btn-map-detail');assert.equal(await p.getAttribute('#btn-map-detail','aria-expanded'),'true');assert.ok(await p.locator('#minimap-canvas').isVisible());await p.tap('#btn-map-detail');await p.tap('#btn-toggle-estimates');assert.ok(await p.locator('#shot-estimate-card').isVisible());
 record('compact glass HUD: map and estimates expand/collapse',controls);
 assert.deepEqual(errors,[]);record('no page/script errors');await ctx.close();
 // Migrate the actual previous worker and app under the GitHub Pages subpath.
 mode='legacy';const legacyCtx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});const lp=await legacyCtx.newPage();
 await lp.goto('http://localhost:8081/Game.PuttClub.ir/');await lp.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&document.querySelector('#offline-state').textContent.startsWith('All '),{timeout:60000});
 await lp.tap('#btn-splash-enter');await lp.tap('[data-skill="scratch"]');await lp.tap('[data-course="mis"]');await lp.tap('#btn-mode-18holes');
 const footprint=async page=>page.evaluate(()=>{
  const ids=['top-left-hud-column','minimap-container','bottom-game-dock','btn-map-detail'];const boxes=ids.map(id=>{const e=document.getElementById(id);if(!e)return null;const r=e.getBoundingClientRect();return{id,width:r.width,height:r.height,area:r.width*r.height};}).filter(Boolean);return {boxes,area:boxes.reduce((n,b)=>n+b.area,0)};
 });
 const prior=await footprint(lp);await lp.screenshot({path:'audit/pwa9/before-game-390.png',animations:'disabled'});
 await lp.evaluate(async()=>{await (await caches.open('putt-club-game-unrelated')).put(new URL('/other/index.html',location.origin),new Response('Other project'));});
 mode='base';requests=[];await lp.goto('http://localhost:8081/Game.PuttClub.ir/?v=pwa9');await lp.waitForFunction(()=>window.PuttBoot?.ready&&window.PuttUI&&proGolferLoaded&&document.querySelector('#runtime-boot').hidden,{timeout:60000});
 const migration=await lp.evaluate(async()=>({state:await PuttBoot.rpc('STATUS'),unrelated:await caches.has('putt-club-game-unrelated')}));
 assert.equal(migration.state.manifest.version,base.version);assert.ok(migration.state.reused>=35);assert.ok(migration.unrelated);
 record('previous deployed worker migration at Pages subpath; unrelated cache preserved',{reused:migration.state.reused,downloaded:migration.state.downloaded,scope:await lp.evaluate(()=>navigator.serviceWorker.controller.scriptURL)});
 await lp.tap('#btn-splash-enter');await lp.tap('[data-skill="scratch"]');await lp.tap('[data-course="mis"]');await lp.tap('#btn-mode-18holes');
 const current=await footprint(lp);assert.ok(current.area<prior.area*.8);await lp.screenshot({path:'audit/pwa9/after-game-390.png',animations:'disabled'});
 record('HUD obstruction reduced without removing primary controls',{prior,current,reductionPercent:Math.round((1-current.area/prior.area)*100)});
 await legacyCtx.setOffline(true);await lp.reload();await lp.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&PuttBoot.status==='offline'&&document.querySelector('#runtime-boot').hidden,{timeout:60000});record('migrated Pages subpath reopens entirely offline');await legacyCtx.close();
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
 fs.mkdirSync('audit/pwa9',{recursive:true});fs.writeFileSync('audit/pwa9/runtime-results.json',JSON.stringify({results,environment:'Headless Chromium / real ServiceWorker and CacheStorage / SwiftShader. iPhone Safari hardware not tested.'},null,2));
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
