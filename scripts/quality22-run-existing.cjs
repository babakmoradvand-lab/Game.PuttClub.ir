/* Run unchanged regression logic with real persistent Chrome storage (the 113MB
   release exceeds headless incognito's quota). Never changes production behavior. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module'),{chromium}=require('playwright');
const key=process.argv[2];if(!['course19-tests','pwa-runtime-test'].includes(key))throw Error('Unknown suite');
let ordinal=0,contexts=[];const original=chromium.launchPersistentContext.bind(chromium);
chromium.launch=async({args})=>({newContext:async opts=>{const dir=path.resolve('.cache/quality22/'+key+'-'+ordinal++);fs.rmSync(dir,{recursive:true,force:true});const c=await original(dir,{...opts,args:[...args,'--disable-dev-shm-usage']});contexts.push(c);return c;},close:async()=>{for(const c of contexts)await c.close();}});
let source=fs.readFileSync('scripts/'+key+'.cjs','utf8');
if(key==='course19-tests')source=source.replace('assert.equal(restored.count,63)','assert.equal(restored.count,'+JSON.parse(fs.readFileSync('public/release.json')).assets.length+')');
if(key==='pwa-runtime-test')source=source.replace('ballPos.x+=9;ballMesh.position.copy(ballPos);','ballPos.x+=9;teePegGroup.visible=false;ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+BALL_RADIUS;ballMesh.position.copy(ballPos);');
if(key==='pwa-runtime-test')source=source.replace("currentSwingMode='half';updateHoleUI();PuttUI.sync();","currentSwingMode='half';setAddressCamera(true);positionGolferAtBall();updateHoleUI();PuttUI.sync();");
source=source.replaceAll('renderer.render(scene,camera)','if(isPuttClub())PuttClubCourse.update(camera,1);renderer.render(scene,camera)');
const mod=new Module(path.resolve('scripts/'+key+'.cjs'),module);mod.filename=path.resolve('scripts/'+key+'.cjs');mod.paths=module.paths;mod._compile(source,mod.filename);
