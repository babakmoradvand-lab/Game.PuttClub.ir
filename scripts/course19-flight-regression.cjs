// Verify the extracted air-step remains numerically identical to aim15 physics.
const fs=require('node:fs'),assert=require('node:assert/strict');
const THREE=require(fs.existsSync('public/three.min.js')?'../public/three.min.js':'../three.min.js');
const old=fs.readFileSync((fs.existsSync('tests/fixtures/aim15-upgrade/game.js')?'tests/fixtures/aim15-upgrade/game.js':'.cache/course19/repo/tests/fixtures/aim15-upgrade/game.js'),'utf8');
const code=fs.readFileSync(fs.existsSync('public/game.js')?'public/game.js':'game.js','utf8');
const start=old.indexOf('          if (speed > 0.01) {',old.indexOf('    function stepPhysics('));
const end=old.indexOf('\n          // Rotate ball in air',start);
assert.ok(start>=0&&end>start);
const original=new Function('ballPos','ballVel','sdt','speed','hasImpacted','club','kDrag','kLift','gravity','windAngle','windSpeedMph',old.slice(start,end));
const helperStart=code.indexOf('    function stepBallFlight('),helperEnd=code.indexOf('    function stepPhysics(',helperStart);
const extracted=new Function('kDrag','kLift','gravity','windAngle','windSpeedMph',code.slice(helperStart,helperEnd)+'\nreturn stepBallFlight;');
let cases=0;
for(const dt of [1/360,1/120,1/60,.04])for(const wind of [0,5,25])for(const angle of [0,1,3])for(const lift of [false,true])for(const initial of [[0,0,0],[.001,.001,0],[30,12,-20],[-5,-2,4],[10,-8,-10]]) {
 const a=new THREE.Vector3(100,250,-50),b=a.clone(),va=new THREE.Vector3(...initial),vb=va.clone();
 original(a,va,dt,va.length(),!lift,{isPutter:false},.002,.00078,9.81,angle,wind);
 extracted(.002,.00078,9.81,angle,wind)(b,vb,dt,lift);
 assert.ok(a.distanceTo(b)<1e-12,'position unchanged');assert.ok(va.distanceTo(vb)<1e-12,'velocity unchanged');cases++;
}
fs.writeFileSync('audit/course19/regression/flight.json',JSON.stringify({passed:true,cases,maxAllowedDifference:1e-12,baseline:'aim15 physical airborne integration'},null,2));
console.log('PASS:',cases,'air-step cases retain the original physical equations');
