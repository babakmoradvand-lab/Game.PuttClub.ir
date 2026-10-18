const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('game.js','utf8');
const a=source.indexOf('    function drawElevationProfile(targetPin) {');
const b=source.indexOf('    function drawMinimap() {',a);
assert.ok(a>=0&&b>a,'drawElevationProfile should exist before drawMinimap');
const nodes={};
for(const id of ['minimap-profile-line','minimap-profile-area','minimap-profile-start','minimap-profile-end','minimap-profile-summary','minimap-elevation-chart']){
 nodes[id]={attrs:{},textContent:'',setAttribute(k,v){this.attrs[k]=v}};
}
const env={
 document:{getElementById:id=>nodes[id]},
 THREE:{MathUtils:{clamp:(x,a,b)=>Math.max(a,Math.min(b,x))}},
 ballPos:{x:0,z:0},
 getAimSurfaceHeight:(x,z)=>x/100+z/200
};
vm.createContext(env);vm.runInContext(source.slice(a,b),env);
env.drawElevationProfile({x:100,y:0,z:0});
const path=nodes['minimap-profile-line'].attrs.d;
assert.match(path,/^M28\.0 /);assert.equal((path.match(/L/g)||[]).length,48,'profile uses 49 real surface samples');
assert.match(nodes['minimap-profile-area'].attrs.d,/L234 48 L28 48 Z$/);
assert.equal(nodes['minimap-profile-start'].attrs.cy,'43.7');
assert.equal(nodes['minimap-profile-end'].attrs.cy,'14.3');
assert.match(nodes['minimap-profile-summary'].textContent,/حفره \+?۱۰۰cm/);
assert.doesNotMatch(nodes['minimap-profile-summary'].textContent,/۱۰۰۰۰/);
assert.match(nodes['minimap-elevation-chart'].attrs['aria-label'],/۴۹ نقطه/);
console.log('PASS: profile follows current lie surface, samples 49 real elevations, and reports centimetres correctly.');
