const assert = require('node:assert/strict');
const fs = require('node:fs');
const root=fs.existsSync('public/game.js')?'public':'.';
const THREE = require(require('path').resolve(root,'three.min.js'));
const html = fs.readFileSync(root+'/game.js', 'utf8');
const start = html.indexOf('    function positionGolferAtBall()');
const end = html.indexOf('    function resetGolferPosture()', start);
const fn = html.slice(start,end);
let ballPos=new THREE.Vector3(30,12,-20);
const aimDirection=new THREE.Vector3(0,0,1);
let holePins3D={},currentHoleNumber=1,currentClubIndex=0,currentSwingMode='full';
let GOLF_BAG=[{}, {isPutter:true}];
let golferGroup=new THREE.Group(),golferSwingPhase='idle',golferSwingProgress=0,strokesCurrentHole=0;
const getTerrainHeight=()=>12;
const resetGolferPosture=()=>{};
eval(fn);
for(let i=0;i<360;i++) {
 for (const elevation of [-50,0,50]) {
  for (currentClubIndex of [0,1]) {
   const a=i*Math.PI/180;
   holePins3D[1]=ballPos.clone().add(new THREE.Vector3(Math.sin(a)*100,elevation,Math.cos(a)*100));
   aimDirection.set(Math.sin(a),0,Math.cos(a));
   positionGolferAtBall();
   const towardBall=ballPos.clone().sub(golferGroup.position).setY(0).normalize();
   const front=new THREE.Vector3(0,0,1).applyQuaternion(golferGroup.quaternion);
   assert.ok(front.dot(towardBall)>0.999999, 'Front must face ball');
   const target=new THREE.Vector3(Math.sin(a),0,Math.cos(a));
   const lead=new THREE.Vector3(1,0,0).applyQuaternion(golferGroup.quaternion);
   assert.ok(lead.dot(target)>0.999999, 'Lead side must face target');
   assert.ok(Math.abs(towardBall.dot(target))<1e-8, 'Stance must be perpendicular to shot');
  }
 }
}
holePins3D[1]=ballPos.clone(); positionGolferAtBall();
assert.ok(Number.isFinite(golferGroup.rotation.y));
assert.equal((html.match(/gltfLoader.load\('pro_golfer_character.glb'/g)||[]).length,1);
console.log('PASS: 2160 address cases, all headings, elevation differences, driver / putter; coincident pin; single GLB loader');
