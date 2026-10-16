const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1366,height:768}});
 await page.goto('http://localhost:8080/');await page.waitForFunction(()=>window.PuttUI&&proGolferLoaded,{},{timeout:90000});
 if(process.env.COURSE==='puttclub')await page.evaluate(async()=>{await switchActiveCourse('puttclub');});
 const result=await page.evaluate(()=>{
  window.PuttBootPaused=true;let samples=0,maxContactError=0,maxWristError=0,worst=null;
  for(const strokes of [0,1])for(let club=0;club<13;club++)for(const heading of [-90,0,90,180]) {
   setupHole(1);strokesCurrentHole=strokes;currentClubIndex=club;
   if(strokes) {ballPos.x+=20;ballPos.y=getTerrainHeight(ballPos.x,ballPos.z)+BALL_RADIUS;ballMesh.position.copy(ballPos);}
   resetAimToPin();setAimAngle(heading);updateSelectedClubUI();
   for(const mode of (club===12?['putt']:['full','three-quarter','half','chip'])) {
    currentSwingMode=mode==='putt'?'full':mode;positionGolferAtBall();
    for(const [phase,p] of [['idle',0],['backswing',1],['downswing',1],['followthrough',1]]) {
     proGolferAnimator.pose(mode,phase,p);const debug=proGolferAnimator.debug();
     if(!debug.contact.every(Number.isFinite)||debug.feet.some(f=>!f.every(Number.isFinite)))throw Error('Non-finite rig pose');
     if(phase==='idle'||phase==='downswing')maxContactError=Math.max(maxContactError,new THREE.Vector3().fromArray(debug.contact).distanceTo(new THREE.Vector3().fromArray(debug.target)));
     if(Math.max(...debug.wristErrors)>maxWristError) {maxWristError=Math.max(...debug.wristErrors);worst={strokes,club,heading,mode,phase,p,errors:debug.wristErrors};}
     if(golferGroup.scale.distanceTo(new THREE.Vector3(1,1,1))>1e-9)throw Error('Athlete rescaled');
     samples++;
    }
    proGolferAnimator.pose(mode,'idle',0);const initial=proGolferAnimator.bones.Grip.scale.clone();
    for(let i=0;i<30;i++)proGolferAnimator.pose(mode,'idle',0);
    if(proGolferAnimator.bones.Grip.scale.distanceTo(initial)>1e-8)throw Error('Grip scale accumulates');
   }
  }
  return {samples,maxContactError,maxWristError,worst,joints:Object.keys(proGolferAnimator.bones).length};
 });
 console.log(result);
 assert.equal(result.joints,51);assert.ok(result.maxContactError<.01);assert.ok(result.maxWristError<.02);
 fs.writeFileSync('audit/course19/regression/aim-rig-'+(process.env.COURSE||'legacy')+'.json',JSON.stringify({passed:true,...result},null,2));console.log('PASS: rig proportions, finite poses, contact and no scale accumulation',result);
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
