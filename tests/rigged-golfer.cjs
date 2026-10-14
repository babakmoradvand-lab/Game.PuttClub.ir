const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
const root=fs.existsSync('public/game.js')?'public':'.';const game=fs.readFileSync(root+'/game.js','utf8'),old=fs.readFileSync(fs.existsSync('audit/character10/game-before.js')?'audit/character10/game-before.js':root+'/tests/fixtures/pwa9/game-before.js','utf8');fs.mkdirSync('audit/character10',{recursive:true});
const block=(s,name)=>{const start=s.indexOf('    function '+name+'(');let i=s.indexOf('{',start),depth=1;for(i++;depth&&i<s.length;i++){if(s[i]==='{')depth++;if(s[i]==='}')depth--;}return s.slice(start,i);};
for(const name of ['calculateShotSpecs','executeGolfShot','stepPhysics','detectLie','updateToptracerYardageTag','updateToptracerRibbon'])assert.equal(block(game,name),block(old,name),'Preserve engine '+name);
(async()=>{const b=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const results=[],errors=[],shader=[];try{
for(const [width,height]of [[390,844],[1366,768]]){
const p=await b.newPage({viewport:{width,height},reducedMotion:'reduce'});p.setDefaultTimeout(90000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')shader.push(m.text())});await p.goto(process.env.GAME_URL||'http://localhost:8080/');await p.waitForFunction(()=>window.PuttUI&&proGolferLoaded&&document.querySelector('#runtime-boot').hidden,{timeout:90000});await p.click('#btn-splash-enter');await p.click('[data-skill="scratch"]');await p.click('[data-course="mis"]');await p.click('#btn-mode-18holes');
const audit=await p.evaluate(()=>{
 window.PuttBootPaused=true;const rig=proGolferAnimator;const values=[];
 const handDistances=()=>{
  const grip=rig.bones.Grip.getWorldPosition(new THREE.Vector3()),direction=new THREE.Vector3(0,1,0).applyQuaternion(rig.bones.Grip.getWorldQuaternion(new THREE.Quaternion()));let minima={L:Infinity,R:Infinity};
  for(const m of rig.skinMeshes){const attrs=m.geometry.attributes,si=attrs.skinIndex,sw=attrs.skinWeight;for(let i=0;i<attrs.position.count;i++){
   let side=null;for(let k=0;k<4;k++){const bone=m.skeleton.bones[si.getComponent?si.getComponent(i,k):si.array[i*4+k]],weight=sw.array[i*4+k];if(weight>.3&&bone&&/^(Hand|Finger)/.test(bone.name)){side=bone.name.at(-1);break;}}if(!side)continue;
   const v=new THREE.Vector3().fromBufferAttribute(attrs.position,i);m.boneTransform(i,v);v.applyMatrix4(m.matrixWorld);const d=v.sub(grip),along=THREE.MathUtils.clamp(d.dot(direction),-.01,.21),dist=d.addScaledVector(direction,-along).length();minima[side]=Math.min(minima[side],dist);
  }}return minima;
 };
 for(let club=0;club<13;club++)for(const mode of (club===12?['putt']:['full','three-quarter','half','chip'])){
  isBallFlying=false;golferSwingPhase='idle';setupHole(1);currentClubIndex=club;currentSwingMode=mode==='putt'?'full':mode;updateSelectedClubUI();
  const contact=rig.contactTarget.clone();let idle=[];
  for(let i=0;i<120;i++)rig.pose(mode,'idle',0);const stable=rig.debug();idle=stable.contact;
  for(const [phase,progress]of [['idle',0],['backswing',.5],['backswing',1],['downswing',.5],['downswing',1],['followthrough',.5],['followthrough',1]]){
   rig.pose(mode,phase,progress);const d=rig.debug();values.push({club,mode,phase,progress,contactError:(phase==='idle'||phase==='downswing'&&progress===1)?new THREE.Vector3().fromArray(d.contact).distanceTo(new THREE.Vector3().fromArray(d.target)):null,wristErrors:d.wristErrors,handDistances:handDistances(),head:d.head,finite:d.contact.every(Number.isFinite),feet:d.feet});
  }
  rig.pose(mode,'idle',0);const after=rig.debug();if(new THREE.Vector3().fromArray(after.contact).distanceTo(new THREE.Vector3().fromArray(idle))>1e-6)throw Error('Idle accumulation');
 }
 isBallFlying=false;golferSwingPhase='idle';setupHole(1);currentClubIndex=0;currentSwingMode='full';updateSelectedClubUI();rig.pose('full','idle',0);renderer.render(scene,camera);
 return {values,skeleton:rig.debug(),shaftCount:rig.skinMeshes.filter(m=>m.name==='ClubShaft').length,fallback:golferHips.visible,legacyClub:clubRig.visible,headVisible:['DriverHead','IronHead','PutterHead'].filter(n=>proGolferModel.getObjectByName(n).visible),lead:new THREE.Vector3(1,0,0).applyQuaternion(golferGroup.quaternion).dot(holePins3D[1].clone().sub(ballPos).setY(0).normalize())};
});
assert.equal(audit.shaftCount,1);assert.equal(audit.fallback,false);assert.equal(audit.legacyClub,false);assert.deepEqual(audit.headVisible,['DriverHead']);assert.equal(audit.skeleton.joints,51);assert.ok(audit.lead>.99999);
for(const value of audit.values){assert.ok(value.finite);if(value.contactError!==null)assert.ok(value.contactError<.00001,JSON.stringify(value));assert.ok(value.wristErrors.every(e=>e<.015),JSON.stringify(value));assert.ok(Object.values(value.handDistances).every(e=>e<.035),JSON.stringify(value));}
await p.screenshot({path:`audit/character10/verified-address-${width}.png`,animations:'disabled'});
// Genuine UI launch: record the actual callback before the ball moves.
const launches=await p.evaluate(()=>{
 const captures=[];
 for(const mode of ['full','three-quarter','half','chip','putt']){
  isBallFlying=false;golferSwingPhase='idle';setupHole(1);currentClubIndex=mode==='putt'?12:6;currentSwingMode=mode==='putt'?'full':mode;updateSelectedClubUI();let hit=0;
  triggerGolferSwing(calculateShotSpecs(currentClubIndex,currentSwingMode),()=>{hit++;const d=proGolferAnimator.debug();captures.push({mode,hit,frame:d.frame,contactError:new THREE.Vector3().fromArray(d.contact).distanceTo(new THREE.Vector3().fromArray(d.target)),preLaunchFlying:isBallFlying});});
  for(let i=0;i<400;i++)updateGolferAnimation(1/240);
  if(hit!==1)throw Error('Impact callback must fire exactly once');
 }
 return captures;
});for(const launch of launches){assert.equal(launch.frame,50);assert.equal(launch.hit,1);assert.equal(launch.preLaunchFlying,false);assert.ok(launch.contactError<.00001);}
results.push({width,height,samples:audit.values.length,maxWristError:Math.max(...audit.values.flatMap(v=>v.wristErrors)),maxHandDistance:Math.max(...audit.values.flatMap(v=>Object.values(v.handDistances))),maxContactError:Math.max(...audit.values.map(v=>v.contactError||0)),oneShaft:true,oneVisibleHead:true,skeleton:audit.skeleton,launches});await p.close();
}
assert.deepEqual(errors,[]);assert.deepEqual(shader,[]);fs.writeFileSync('audit/character10/rig-results.json',JSON.stringify({results,errors,shader,physicsSourceEquality:true,environment:'Chromium / real Three.js skinning and clips / SwiftShader; no physical iPhone test'},null,2));console.log(JSON.stringify({results,errors,shader},null,2));}finally{await b.close()}})();
