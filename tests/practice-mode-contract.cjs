const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('index.html','utf8');
const ui=fs.readFileSync('ui.js','utf8');
const game=fs.readFileSync('game.js','utf8');
const course=JSON.parse(fs.readFileSync('courses/puttclub/course.json','utf8'));
const surfaces=JSON.parse(fs.readFileSync('courses/puttclub/surfaces.json','utf8'));

const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(ids.length,new Set(ids).size,'HTML ids must be unique');
for(const id of ['btn-mode-practice','practice-type-modal','practice-holes-modal','practice-quick-controls','btn-practice-range-reset-mode','btn-practice-place','btn-clear-practice-trajectories'])assert.ok(ids.includes(id),`missing practice UI: ${id}`);
assert.match(ui,/listen\("btn-mode-practice",\s*\(\)\s*=>\s*showStep\("practiceType"\)\)/);
assert.match(ui,/data-practice-type/);
assert.match(ui,/window\.PuttPractice\.start\(\{type,hole,tee: selectedPracticeTee,returnState\}\)/);
assert.match(ui,/function renderPracticeHoles\(\)/);
assert.match(ui,/window\.PuttPractice\?\.toggleRangeReset\?\.\(\)/);
assert.match(game,/practiceSession=\{type,hole,tee,resetToTee:true,placing:false,anchorBall:null,shots:0,savedShots:0,returnState\}/);
assert.match(game,/practicePointOnGreen\(x,z\)/);
assert.match(game,/window\.PuttPractice\.placeAt\(point\.x,point\.z\)/);
assert.match(game,/gameMode==='practice_range'&&practiceSession\?\.resetToTee!==false\)\{resetPracticeBall\(\{preserveTelemetry:true,quiet:true\}\);return;\}/);
assert.match(game,/if\(gameMode==='practice_range'\|\|gameMode==='practice_putting'\)\{updatePracticeAfterHole\(\);return;\}/);
assert.match(ui,/if\(gameMode==='practice_range'\|\|gameMode==='practice_putting'\)return null/,'practice must not overwrite the saved normal-round session');
const completion=game.slice(game.indexOf('function handleHoleCompleted()'),game.indexOf('function renderScorecardTable()'));
assert.ok(completion.indexOf("if(gameMode==='practice_range'")<completion.indexOf('holeScores[currentHoleNumber] = strokesCurrentHole'),'practice bypasses score/progression before score mutation');
assert.equal(course.holes.length,18,'PuttClub practice should support all 18 holes');
function inside(x,z,ring){let hit=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[j],b=ring[i];if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;}return hit;}
function inPoly(x,z,s){const polys=s.boundaryPolygonsXZ;if(polys)return polys.some(p=>inside(x,z,p.outer)&&!(p.holes||[]).some(h=>inside(x,z,h)));return inside(x,z,s.boundaryPolygonXZ);}
const orderedSurfaces=[...surfaces.surfaces].sort((a,b)=>b.priority-a.priority);
function surfaceAt(x,z){return orderedSurfaces.find(s=>inPoly(x,z,s))||{type:'rough'};}
for(const hole of course.holes){
  const colors=hole.tees.map(t=>t.color);
  for(const color of ['blue','white','red'])assert.ok(colors.includes(color),`hole ${hole.number} missing ${color} range tee`);
  assert.ok(surfaces.surfaces.some(s=>s.holeNumber===hole.number&&s.type==='green'),`hole ${hole.number} missing a putting green surface`);
  const pin=hole.pins.find(p=>p.isDefault).position;
  let spawn=null;
  for(const r of [2.5,3.5,4.5,5.5,1.5,6.5])for(let k=0;k<16&&!spawn;k++){const a=k*Math.PI/8,x=pin[0]+Math.cos(a)*r,z=pin[2]+Math.sin(a)*r,s=surfaceAt(x,z);if(s.type==='green'&&s.holeNumber===hole.number)spawn={r,k};}
  assert.ok(spawn,`hole ${hole.number} has no safe default practice-putt start`);
}
console.log('PASS: free-practice UI, repeat/reset controls, green placement, score isolation, all 18 greens and 54 PuttClub tee positions.');
