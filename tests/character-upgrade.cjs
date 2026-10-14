/* Upgrade the actual pwa9 cached application/model to rig10; offline afterwards. */
const {chromium}=require('playwright'),fs=require('fs'),path=require('path'),http=require('http'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(fs.existsSync('public/index.html')?'public':'.');
const fixtures=fs.existsSync('audit/character10/release-before.json')?'audit/character10':path.join(root,'tests/fixtures/pwa9');
const current=JSON.parse(fs.readFileSync(path.join(root,'release.json'))),previous=JSON.parse(fs.readFileSync(path.join(fixtures,'release-before.json')));
const oldFiles=new Map(previous.assets.map(a=>[a.url.slice(2),fs.readFileSync(path.join(root,a.url.slice(2)))]));
for(const [file,backup]of [['index.html','index-before.html'],['game.js','game-before.js'],['ui.js','ui-before.js'],['boot.js','boot-before.js'],['sw.js','sw-before.js'],['pro_golfer_character.glb','golfer-before.glb']])oldFiles.set(file,fs.readFileSync(path.join(fixtures,backup)));
for(const asset of previous.assets)assert.equal(crypto.createHash('sha256').update(oldFiles.get(asset.url.slice(2))).digest('hex'),asset.sha256,'Actual old build '+asset.url);
const nowFiles=new Map(current.assets.map(a=>[a.url.slice(2),fs.readFileSync(path.join(root,a.url.slice(2)))]));
let upgraded=false,network=[];const types={html:'text/html',js:'application/javascript',css:'text/css',json:'application/json',png:'image/png',jpg:'image/jpeg',ttf:'font/ttf',glb:'model/gltf-binary',webp:'image/webp'};
const server=http.createServer((req,res)=>{let url=new URL(req.url,'http://localhost:8082'),name=url.pathname.replace(/^\/Game.PuttClub.ir\//,'').split('?')[0]||'index.html';network.push(name);const data=name==='release.json'?Buffer.from(JSON.stringify(upgraded?current:previous)):(upgraded?nowFiles:oldFiles).get(name);if(!data){res.writeHead(404);res.end();return;}res.writeHead(200,{'Content-Type':types[name.split('.').at(-1)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);});
(async()=>{fs.mkdirSync('audit/character10',{recursive:true});await new Promise(r=>server.listen(8082,'0.0.0.0',r));const b=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
const c=await b.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'}),p=await c.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));const ready=()=>p.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&document.querySelector('#runtime-boot').hidden,{timeout:90000});
await p.goto('http://localhost:8082/Game.PuttClub.ir/');await ready();assert.equal(await p.evaluate(()=>PuttBoot.version),previous.version);
await p.tap('#btn-splash-enter');await p.tap('[data-skill="mid"]');await p.tap('[data-course="tehran"]');await p.tap('#btn-mode-custom-hole');await p.tap('.hole-pick-card:nth-child(3)');
await p.evaluate(()=>{strokesCurrentHole=2;holeScores[1]=3;ballPos.x+=2;ballMesh.position.copy(ballPos);currentClubIndex=6;currentSwingMode='half';updateSelectedClubUI();});
const before=await p.evaluate(()=>PuttUI.exportSession());upgraded=true;network=[];
await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForFunction(version=>window.PuttBoot?.version===version&&window.PuttUI&&typeof proGolferAnimator!=='undefined'&&proGolferAnimator&&proGolferLoaded&&document.querySelector('#runtime-boot').hidden,current.version,{timeout:90000});
const after=await p.evaluate(()=>PuttUI.exportSession());for(const key of ['skill','course','mode','hole','strokes','tee','scores','club','swing','ball'])assert.deepEqual(after[key],before[key],key);
const installed=await p.evaluate(()=>PuttBoot.rpc('STATUS'));assert.equal(installed.manifest.assets.length,current.assets.length);assert.ok(installed.reused>=43);assert.ok(network.includes('pro_golfer_character.glb'));assert.ok(network.includes('golfer-rig.js'));
const migrated=await p.evaluate(()=>({version:PuttBoot.version,character:proGolferAnimator.debug(),strokes:strokesCurrentHole,hole:currentHoleNumber}));
await c.setOffline(true);await p.reload();await ready();assert.equal(await p.evaluate(()=>PuttBoot.status),'offline');assert.equal(await p.evaluate(()=>proGolferAnimator.debug().joints),51);
assert.deepEqual(errors,[]);const result={previous:previous.version,current:current.version,downloaded:installed.downloaded,reused:installed.reused,network,migrated,offlineCharacterLoaded:true,errors};fs.writeFileSync('audit/character10/upgrade-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));await c.close();
}finally{await b.close();await new Promise(r=>server.close(r));}})();
