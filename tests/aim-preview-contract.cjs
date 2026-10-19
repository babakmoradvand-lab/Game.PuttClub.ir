const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const start=source.indexOf('    function getAimGuideLength() {');
const end=source.indexOf('    function updateAimRibbon(pts) {',start);
assert.ok(start>=0&&end>start,'shot preview helpers should be present');
class V3{
 constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}
 clone(){return new V3(this.x,this.y,this.z)}
 set(x,y,z){this.x=x;this.y=y;this.z=z;return this}
 setY(y){this.y=y;return this}
 length(){return Math.hypot(this.x,this.y,this.z)}
 normalize(){const n=this.length()||1;this.x/=n;this.y/=n;this.z/=n;return this}
 multiplyScalar(s){this.x*=s;this.y*=s;this.z*=s;return this}
 addScaledVector(v,s){this.x+=v.x*s;this.y+=v.y*s;this.z+=v.z*s;return this}
 lerp(v,t){this.x+=(v.x-this.x)*t;this.y+=(v.y-this.y)*t;this.z+=(v.z-this.z)*t;return this}
 toArray(){return [this.x,this.y,this.z]}
}
const settings={face:0,path:0,feet:0,pressure:0};
const dir=new V3(0,0,1);
const env={
 THREE:{Vector3:V3,MathUtils:{degToRad:d=>d*Math.PI/180,clamp:(x,a,b)=>Math.max(a,Math.min(b,x))}},
 GOLF_BAG:[{id:'1W',v0:24,loft:12,isPutter:false},{id:'PT',v0:3,loft:3,isPutter:true}],
 currentClubIndex:0,currentSwingMode:'full',swingPowerPercent:100,currentHoleNumber:1,
 holePins3D:{1:{x:100,y:0,z:0}},ballPos:new V3(0,.2,0),aimDirection:dir,
 teePegGroup:{position:new V3()},strokesCurrentHole:1,BALL_RADIUS:.021,gravity:9.81,kDrag:.002,kLift:.00078,
 currentHandicap:'scratch',handicapMultipliers:{scratch:1},wind:{x:0,z:0},putterSlider:{value:'35'},
 window:{WindSystem:{physicsWind(){return env.wind}},ShotTechnique:{
  launch(base,club,mode,direction){
   const side=(settings.face+settings.path+settings.feet*.25)*Math.PI/180;
   const speed=base.length();
   const right=new V3(direction.z,0,-direction.x);
   base.x=direction.x*Math.cos(side)*speed+right.x*Math.sin(side)*speed;
   base.z=direction.z*Math.cos(side)*speed+right.z*Math.sin(side)*speed;
   base.y+=settings.pressure*.35;
   base.shotImpact={active:true,side};return base;
  },
  air(velocity,_air,dt){velocity.x+=settings.path*.08*dt;velocity.y+=settings.pressure*.1*dt}
 }},
 detectLie:()=>({penalty:1}),
 calculateShotSpecs:(_club,mode,power)=>({carryMultiplier:power==null?({full:1,half:.5,'three-quarter':.75,chip:.25}[mode]||1):power/100}),
 getTerrainHeight:()=>0,
 getAimSurfaceHeight:(x,z)=>.002*x+.001*z,
 stepBallFlight(position,velocity,dt,applyLift){
  const air=new V3(velocity.x-env.wind.x,velocity.y,velocity.z-env.wind.z);
  if(applyLift)env.window.ShotTechnique.air(velocity,air,dt);
  velocity.y-=env.gravity*dt;position.addScaledVector(velocity,dt);
 }
};
env.ShotTechnique=env.window.ShotTechnique;
vm.createContext(env);vm.runInContext(source.slice(start,end),env);
const points=()=>Array.from(env.getAimGuidePoints(),p=>[p.x,p.y,p.z]);
const base=points();
assert.ok(base.length>2,'non-putter preview includes integrated flight samples');
assert.ok(base.some(p=>p[1]>env.ballPos.y+.05),'guide has a real airborne arc');
const limit=env.getAimGuideLength();assert.ok(limit<=30*.9144+1e-9);
const originalPin=env.holePins3D[1];
const anglePath=points();env.aimDirection=new V3(.35,0,Math.sqrt(1-.35*.35));
const rotated=points();assert.notDeepEqual(rotated,anglePath,'rotating aim must rotate the predicted shot path');
const rotatedBaseline=rotated;
settings.face=7;assert.notDeepEqual(points(),rotatedBaseline,'clubface setting must alter the preview geometry');
settings.face=0;settings.path=5;assert.notDeepEqual(points(),rotatedBaseline,'swing-path setting must alter the preview geometry');
settings.path=0;settings.feet=8;assert.notDeepEqual(points(),rotatedBaseline,'stance/feet settings must reach the shot preview');
settings.feet=0;settings.pressure=.7;assert.notDeepEqual(points(),rotatedBaseline,'pressure delivery setting must reach the shot preview');
settings.pressure=0;env.swingPowerPercent=55;assert.notDeepEqual(points(),rotatedBaseline,'continuous power must alter the predicted shot');
env.swingPowerPercent=100;env.currentClubIndex=1;env.currentSwingMode='full';
const putt=points();assert.equal(putt.length,49,'putter preview follows the ground surface');
settings.face=0;const puttBase=points();settings.face=5;assert.notDeepEqual(points(),puttBase,'putter face setting must rotate its ground path');
env.holePins3D[1]=originalPin;
const tracer=source.slice(source.indexOf('    function updateAimTracer() {'),source.indexOf('    // Single-pointer look/aim',source.indexOf('    function updateAimTracer() {')));
assert.match(tracer,/const points = getAimGuidePoints\(\)/);
assert.doesNotMatch(tracer,/cachedAim|pin\.x.*ballPos/);
const ribbon=source.slice(source.indexOf('    function updateAimRibbon(pts) {'),source.indexOf('    function syncAimControlsLayout()',source.indexOf('    function updateAimRibbon(pts) {')));
assert.match(ribbon,/aimLineMat\.uniforms\.dash\.value = isPutter \? 0\.18 : 1\.1/);
const map=source.slice(source.indexOf('// Aim Line (not a second, misleading trajectory during ball motion)'),source.indexOf('// Hole Pin',source.indexOf('// Aim Line (not a second, misleading trajectory during ball motion)')));
assert.match(map,/lineTo\(pM\.mx, pM\.my\)/);
assert.doesNotMatch(map,/aimDirection|currentSwingMode|ShotTechnique/,'radar still shows the direct ball-to-cup target, not predicted flight');
const tech=fs.readFileSync('technique-ui.js','utf8');
assert.match(tech,/function apply\(k,v\).*?updateSelectedClubUI\(\)/);
console.log('PASS: 3D preview tracks aim rotation and advanced shot settings; radar target remains fixed ball-to-cup.');
