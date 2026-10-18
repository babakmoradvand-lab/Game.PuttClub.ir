const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const extract=(start,end)=>{
 const a=source.indexOf(start),b=source.indexOf(end,a);
 assert.notEqual(a,-1,`missing ${start}`);assert.notEqual(b,-1,`missing ${end}`);
 return source.slice(a,b);
};
class V3 {constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z}}
const code=extract('    function getAimGuideLength() {','    function updateAimRibbon(pts) {');
const env={
 holePins3D:{1:{x:100,y:0,z:40}},currentHoleNumber:1,
 ballPos:new V3(10,0,4),strokesCurrentHole:1,teePegGroup:{position:new V3()},
 getTerrainHeight:(x,z)=>.012*x+.004*z,
 THREE:{Vector3:V3,MathUtils:{lerp:(a,b,t)=>a+(b-a)*t}},
 currentClubIndex:0,currentSwingMode:'full',swingPowerPercent:100,technique:{face:0},aimDirection:new V3(1,0,0)
};
vm.createContext(env);vm.runInContext(code,env);
const snapshot=()=>env.getAimGuidePoints().map(p=>[p.x,p.y,p.z]);
const base=snapshot();
assert.equal(base.length,49,'guide should be a stable 49-point polyline');
assert.deepEqual(base[0],[10,env.getAimSurfaceHeight(10,4)+.03,4]);
assert.deepEqual(base.at(-1),[100,env.getAimSurfaceHeight(100,40)+.03,40]);
for(let i=0;i<base.length;i++){
 const t=i/48;
 assert.ok(Math.abs(base[i][0]-(10+90*t))<1e-10);
 assert.ok(Math.abs(base[i][2]-(4+36*t))<1e-10);
}
const baselineLength=env.getAimGuideLength();
for(const change of [
 ()=>{env.currentClubIndex=12},
 ()=>{env.currentSwingMode='half'},
 ()=>{env.swingPowerPercent=17},
 ()=>{env.technique.face=5},
 ()=>{env.aimDirection=new V3(-1,0,0)}
]){change();assert.deepEqual(snapshot(),base,'settings/look heading must not move the lie-to-cup line');assert.equal(env.getAimGuideLength(),baselineLength)}
const movedBall=env.ballPos;env.ballPos=new V3(11,0,4);assert.notDeepEqual(snapshot(),base,'a changed lie must recalculate the line');
env.ballPos=movedBall;env.holePins3D[1]={x:100,y:0,z:41};assert.notDeepEqual(snapshot(),base,'a changed destination must recalculate the line');
const keyMatch=source.match(/const key=pin\?\[window\.activeCourseId,currentHoleNumber,ballPos\.x,ballPos\.y,ballPos\.z,pin\.x,pin\.y,pin\.z\]\.join\('\|'\)/);
assert.ok(keyMatch,'geometry cache key should contain only course/hole/lie/destination');
assert.doesNotMatch(keyMatch[0],/currentClub|currentSwing|power|technique|aimDirection/);
const html=fs.readFileSync('index.html','utf8');
assert.match(html,/id="minimap-profile-wrap"[\s\S]*?id="minimap-elevation-chart"/);
assert.match(html,/id="tech-help-dialog"/);
assert.match(html,/id="btn-pre-round-technique"/);
assert.equal((html.match(/data-tech-help=/g)||[]).length,13,'each technique item and swing-arc group has a dedicated info button');
console.log('PASS: target line is direct, terrain-following, settings-independent, and keyed to lie/destination only.');
