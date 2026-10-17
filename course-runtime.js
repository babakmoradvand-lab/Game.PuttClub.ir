/* PuttClub independent metric course adapter. Original MIS path is untouched.
   Geometry: patched author GLB. Terrain point queries: indexed world triangles.
   Tree collision: swept sphere against trunk/branch capsules; canopy entry damping.
   Near forest uses original 3D meshes; far forest uses multi-view source-rendered impostors. Player remains a true rigged 3D GLB. */
(() => {
'use strict';
const T=THREE,BASE='./courses/puttclub/',CELL=12,TREECELL=32;
const vec=a=>new T.Vector3().fromArray(a),key=(x,z,s)=>`${Math.floor(x/s)},${Math.floor(z/s)}`;
function inside(x,z,p) {let v=false;for(let i=0,j=p.length-1;i<p.length;j=i++){const a=p[i],b=p[j];if((a[1]>z)!=(b[1]>z)&&x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])v=!v;}return v;}
function bounds(p){return [Math.min(...p.map(a=>a[0])),Math.min(...p.map(a=>a[1])),Math.max(...p.map(a=>a[0])),Math.max(...p.map(a=>a[1]))];}
function inBounds(x,z,b){return x>=b[0]&&z>=b[1]&&x<=b[2]&&z<=b[3];}
function distanceSegment(p,a,b) {const d=b.clone().sub(a),t=T.MathUtils.clamp(p.clone().sub(a).dot(d)/Math.max(1e-12,d.lengthSq()),0,1),q=a.clone().addScaledVector(d,t);return {distance:p.distanceTo(q),q};}
// Earliest sphere/capsule time of impact along a finite motion segment.
function capsuleHit(from,to,a,b,r){
 const delta=to.clone().sub(from),length=delta.length(),start=distanceSegment(from,a,b);
 if(start.distance<r-1e-5)return {t:0,q:start.q};if(length<1e-9)return null;
 const rd=delta.multiplyScalar(1/length),ba=b.clone().sub(a),oa=from.clone().sub(a),baba=ba.lengthSq(),bard=ba.dot(rd),baoa=ba.dot(oa),rdoa=rd.dot(oa),oaoa=oa.lengthSq();
 const A=baba-bard*bard,B=baba*rdoa-baoa*bard,C=baba*oaoa-baoa*baoa-r*r*baba;let best=Infinity;
 if(Math.abs(A)>1e-10){const h=B*B-A*C;if(h>=0){const t=(-B-Math.sqrt(h))/A,y=baoa+t*bard;if(t>=0&&y>=0&&y<=baba)best=t;}}
 for(const center of [a,b]){const oc=from.clone().sub(center),b0=rd.dot(oc),h=b0*b0-oc.lengthSq()+r*r;if(h>=0){const t=-b0-Math.sqrt(h);if(t>=0)best=Math.min(best,t);}}
 if(best>length)return null;const p=from.clone().addScaledVector(rd,best);return {t:best/length,q:distanceSegment(p,a,b).q};
}
class Course {
 constructor(){this.root=new T.Group();this.root.name='PuttClubAuthoredCourse';this.root.visible=false;this.bins=new Map();this.triangles=[];this.treeBins=new Map();this.canopies=new Set();this.diagnostics={trunkHits:0,branchHits:0,canopyHits:0};this.active=false;this.visualPromise=null;}
 async prepare(){
  const read=async n=>{const r=await fetch(BASE+n);if(!r.ok)throw Error('Course file unavailable: '+n);return r.json();};
  [this.data,this.surfaces,this.trees,this.dropZones]=await Promise.all(['course.json','surfaces.json','trees.json','drop_zones.json'].map(read));
  this.holeCards={};for(const h of this.data.holes)this.holeCards[h.number]={...h,tees:h.tees.map(t=>({...t,par:h.par,yard:t.distanceToPinYards}))};
  this.surfaceList=this.surfaces.surfaces.map(s=>({...s,bbox:bounds(s.boundaryPolygonsXZ?s.boundaryPolygonsXZ.flatMap(p=>p.outer):s.boundaryPolygonXZ)})).sort((a,b)=>b.priority-a.priority);
  this.water=this.data.penaltyAreas.map(h=>({...h,bbox:bounds(h.boundaryPolygonXZ),waterBox:bounds(h.waterPolygonXZ)}));
  const glb=await this.glb('course_collision.glb');glb.scene.updateMatrixWorld(true);
  glb.scene.traverse(m=>{if(!m.isMesh)return;const a=m.geometry.attributes.position,idx=m.geometry.index,p=new T.Vector3();const vertices=new Float32Array(a.count*3);for(let i=0;i<a.count;i++){p.fromBufferAttribute(a,i).applyMatrix4(m.matrixWorld);p.toArray(vertices,i*3);}
   const n=idx?idx.count:a.count;for(let i=0;i<n;i+=3){const ids=[0,1,2].map(k=>(idx?idx.getX(i+k):i+k)*3),t=ids.flatMap(i=>[vertices[i],vertices[i+1],vertices[i+2]]);const den=(t[3]-t[0])*(t[8]-t[2])-(t[6]-t[0])*(t[5]-t[2]);if(Math.abs(den)<1e-10)continue;
    const id=this.triangles.length;this.triangles.push(new Float32Array([...t,1/den]));const minX=Math.floor(Math.min(t[0],t[3],t[6])/CELL),maxX=Math.floor(Math.max(t[0],t[3],t[6])/CELL),minZ=Math.floor(Math.min(t[2],t[5],t[8])/CELL),maxZ=Math.floor(Math.max(t[2],t[5],t[8])/CELL);
    for(let x=minX;x<=maxX;x++)for(let z=minZ;z<=maxZ;z++){const k=`${x},${z}`;if(!this.bins.has(k))this.bins.set(k,[]);this.bins.get(k).push(id);}
   }m.geometry.dispose();});
  this.treeTypes=Object.fromEntries(this.trees.treeTypes.map(t=>[t.typeId,t]));
  this.trees.instances.forEach((t,i)=>{const k=key(t.position[0],t.position[2],TREECELL);if(!this.treeBins.has(k))this.treeBins.set(k,[]);this.treeBins.get(k).push(i);});
  this.ready=true;return this;
 }
 glb(name){return new Promise((resolve,reject)=>new T.GLTFLoader().load(BASE+name,resolve,undefined,reject));}
 height(x,z,withNormal=false){
  let y=-Infinity,hit=null;for(const id of this.bins.get(key(x,z,CELL))||[]){const t=this.triangles[id],dx=x-t[0],dz=z-t[2],u=(dx*(t[8]-t[2])-dz*(t[6]-t[0]))*t[9],v=((t[3]-t[0])*dz-(t[5]-t[2])*dx)*t[9];if(u>=-1e-5&&v>=-1e-5&&u+v<=1.00001){const h=t[1]+u*(t[4]-t[1])+v*(t[7]-t[1]);if(h>y){y=h;hit=t;}}}
  if(!Number.isFinite(y))y=-6;
  if(!withNormal)return y;
  const n=hit?new T.Vector3(hit[3]-hit[0],hit[4]-hit[1],hit[5]-hit[2]).cross(new T.Vector3(hit[6]-hit[0],hit[7]-hit[1],hit[8]-hit[2])).normalize():new T.Vector3(0,1,0);if(n.y<0)n.negate();return {y,normal:n};
 }
 surface(x,z){for(const s of this.surfaceList){if(!inBounds(x,z,s.bbox))continue;const ps=s.boundaryPolygonsXZ;if(ps?ps.some(p=>inside(x,z,p.outer)&&!p.holes.some(h=>inside(x,z,h))):inside(x,z,s.boundaryPolygonXZ))return s;}return {type:'rough',priority:0};}
 lie(pos,plugged=false){const type=this.surface(pos.x,pos.z).type,dict={tee:['Tee','جایگاه تی',1],green:['Green','گرین چمن',1],fairway:['Fairway','فیروی',1],fringe:['Fringe','فرینج',.98],bunker:['Bunker',plugged?'شن · توپ مدفون':'بانکر شن',plugged?.40:.58],rough:['Rough','راف',.86],heavy_rough:['HeavyRough','راف سنگین',.68]},v=dict[type]||dict.rough;return {type:v[0],name:v[1],penalty:v[2],badge:type==='green'?'lie-green':type==='bunker'?'lie-sand':type.includes('rough')?'lie-rough':'lie-fairway'};}
 areaAt(p){return this.water.find(h=>inBounds(p.x,p.z,h.bbox)&&inside(p.x,p.z,h.boundaryPolygonXZ)&&!(h.exceptionIslandsXZ||[]).some(q=>inside(p.x,p.z,q)))||null;}
 wetAt(p){return this.water.find(h=>p.y<=h.waterLevelY+.021335&&inBounds(p.x,p.z,h.waterBox)&&inside(p.x,p.z,h.waterPolygonXZ)&&!(h.exceptionIslandsXZ||[]).some(q=>inside(p.x,p.z,q)))||null;}
 inPlay(p){return inside(p.x,p.z,this.data.outOfBounds.playableBoundaryPolygonXZ);}
 crossings(from,to,entries){for(const h of this.water){const a=inside(from.x,from.z,h.boundaryPolygonXZ)&&!(h.exceptionIslandsXZ||[]).some(q=>inside(from.x,from.z,q)),b=inside(to.x,to.z,h.boundaryPolygonXZ)&&!(h.exceptionIslandsXZ||[]).some(q=>inside(to.x,to.z,q));if(!a&&b){let lo=0,hi=1;for(let k=0;k<25;k++){const m=(lo+hi)/2,p=from.clone().lerp(to,m);if(inside(p.x,p.z,h.boundaryPolygonXZ)&&!(h.exceptionIslandsXZ||[]).some(q=>inside(p.x,p.z,q)))hi=m;else lo=m;}entries[h.id]=from.clone().lerp(to,(lo+hi)/2);}}}
 safePoint(p,pin,minDistance=0){return this.inPlay(p)&&!this.areaAt(p)&&p.distanceTo(new T.Vector3(pin.x,p.y,pin.z))>=minDistance-.001&&this.surface(p.x,p.z).type!=='green';}
 reliefOptions(pending,pin,hole){
  const options=[{id:'stroke-distance',label:pending.kind==='ob'?'خارج زمین · ضربه و فاصله (+۱)':'بازگشت به محل ضربه (+۱)',position:vec(pending.shotStart),tee:pending.fromTee}];
  if(pending.kind==='dry')options.unshift({id:'play',label:'بازی از همین محل (بدون جریمه)',position:vec(pending.ball)});
  const h=this.water.find(h=>h.id===pending.hazardId),cross=pending.cross?vec(pending.cross):null;
  if(h&&cross){const ref=Math.hypot(cross.x-pin.x,cross.z-pin.z),candidates=[];for(let k=0;k<144;k++){const a=k*Math.PI*2/144,p=cross.clone().add(new T.Vector3(Math.cos(a)*2.15,0,Math.sin(a)*2.15));p.y=this.height(p.x,p.z)+.021335;if(this.safePoint(p,pin,ref)&&!this.areaAt(p.clone().add(new T.Vector3(.025,0,0)))&&!this.areaAt(p.clone().add(new T.Vector3(-.025,0,0))))candidates.push(p);}
   if(candidates.length)options.push({id:'lateral',label:'کنار آب · حداکثر دو طول کلاب (+۱)',position:candidates[0],reference:cross.toArray()});
   const dir=cross.clone().sub(pin).setY(0).normalize();for(const d of [2,4,8,12,20,35,55,80,120,180]){const p=cross.clone().addScaledVector(dir,d);p.y=this.height(p.x,p.z)+.021335;if(this.safePoint(p,pin,ref)){options.push({id:'back-line',label:`روی خط عقب · ${d} متر پس از مرز (+۱)`,position:p,reference:cross.toArray()});break;}}
  }
  if(h)for(const d of this.dropZones.dropZones)if(d.penaltyAreaId===h.id&&d.holeNumbers.includes(hole))options.push({id:d.id,label:'ناحیهٔ رهاسازی تعیین‌شده (+۱)',position:vec(d.center).add(new T.Vector3(0,.021335,0))});
  return options;
 }
 treeCandidates(from,to){const ids=[];for(let x=Math.floor((Math.min(from.x,to.x)-28)/TREECELL);x<=Math.floor((Math.max(from.x,to.x)+28)/TREECELL);x++)for(let z=Math.floor((Math.min(from.z,to.z)-28)/TREECELL);z<=Math.floor((Math.max(from.z,to.z)+28)/TREECELL);z++)ids.push(...(this.treeBins.get(`${x},${z}`)||[]));return ids;}
 collideTrees(from,to,velocity,radius){
  let best=null;const entered=new Set();for(const id of this.treeCandidates(from,to)){
   const tree=this.trees.instances[id],wx=to.x-from.x,wz=to.z-from.z,den=wx*wx+wz*wz,t=den?T.MathUtils.clamp(((tree.position[0]-from.x)*wx+(tree.position[2]-from.z)*wz)/den,0,1):0,rr=this.treeTypes[tree.typeId].canopyRadiusM*Math.max(tree.scale[0],tree.scale[2])+1;if(Math.hypot(from.x+wx*t-tree.position[0],from.z+wz*t-tree.position[2])>rr||Math.min(from.y,to.y)>tree.position[1]+tree.worldHeightM+2)continue;const type=this.treeTypes[tree.typeId],scale=vec(tree.scale),origin=vec(tree.position),q=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),T.MathUtils.degToRad(tree.rotationYDeg)),world=a=>vec(a).multiply(scale).applyQuaternion(q).add(origin);
   const cv=type.canopyVolume,center=world(cv.centerLocal),radii=vec(cv.radiiM).multiply(scale),local=p=>p.clone().sub(center).applyQuaternion(q.clone().invert()).divide(radii);const end=local(to);if(end.lengthSq()<1)entered.add(id);
   const cf=local(from),ct=local(to),dd=ct.clone().sub(cf),aa=dd.lengthSq(),bb=cf.dot(dd),cc=cf.lengthSq()-1,disc=bb*bb-aa*cc;const crossed=aa>1e-12&&disc>=0&&(-bb-Math.sqrt(disc))/aa>=0&&(-bb-Math.sqrt(disc))/aa<=1;
   if(!this.canopies.has(id)&&(end.lengthSq()<1||crossed)){velocity.multiplyScalar(.60);velocity.y=Math.min(velocity.y,-.35);this.diagnostics.canopyHits++;}
   const capsules=[...type.trunkCollider.segments.map(s=>({...s,radiusM:Math.max(s.radiusBottomM,s.radiusTopM),kind:'trunk'})),...type.branchColliders.map(s=>({...s,kind:'branch'}))];
   for(const s of capsules){const a=world(s.startLocal),b=world(s.endLocal),r=s.radiusM*Math.max(scale.x,scale.z)+radius,h=capsuleHit(from,to,a,b,r);if(h&&(!best||h.t<best.t))best={...h,a,b,r,kind:s.kind,treeId:tree.id};}
  }
  this.canopies=entered;
  if(best){const p=from.clone().lerp(to,best.t),normal=p.clone().sub(best.q).normalize();if(normal.lengthSq()<.5)normal.copy(velocity).negate().normalize();to.copy(best.q).addScaledVector(normal,best.r+.002);const vn=velocity.dot(normal);if(vn<0){velocity.addScaledVector(normal,-1.22*vn);const n=normal.clone().multiplyScalar(velocity.dot(normal)),tan=velocity.clone().sub(n).multiplyScalar(.52);velocity.copy(n).add(tan);}this.diagnostics[best.kind==='trunk'?'trunkHits':'branchHits']++;return best;}return null;
 }
 async loadVisual(){if(this.visualPromise)return this.visualPromise;this.visualPromise=this._visual().catch(e=>{this.visualPromise=null;throw e;});return this.visualPromise;}
 async _visual(){
  const [v,ns,...ts]=await Promise.all([this.glb('course_visual.glb'),PuttSourceNative.load(),...this.trees.treeTypes.map(t=>this.glb(t.assetPath))]);this.native=ns;ns.bind(v.scene);v.scene.traverse(m=>{if(m.isMesh){m.receiveShadow=true;m.castShadow=false;}});this.root.add(v.scene);this.visualScene=v.scene;this.root.add(ns.makeSky());
  const nature=await this.glb('native/nature.glb');ns.bind(nature.scene);nature.scene.traverse(m=>{if(m.isMesh&&m.name.startsWith('H01_Hero_'))this.root.add(m.clone());});const protos=new Map();nature.scene.traverse(m=>{if(m.isMesh){const n=m.name.replace(/_\d+$/,'');if(!protos.has(m.name))protos.set(m.name,[]);protos.get(m.name).push(m);}});this.natureChunks=[];
  const obj=new T.Object3D(),basis=new T.Quaternion().setFromAxisAngle(new T.Vector3(1,0,0),-Math.PI/2),ib=basis.clone().invert();
  for(const scatter of ns.spec.scatter){const groups=new Map();for(const tr of scatter.points){const name=scatter.children[((tr.i%scatter.children.length)+scatter.children.length)%scatter.children.length],k=name+'/'+key(tr.p[0],tr.p[2],48);if(!groups.has(k))groups.set(k,{name,list:[]});groups.get(k).list.push(tr);}for(const {name,list}of groups.values()){let parts=protos.get(name);if(!parts){parts=[];nature.scene.traverse(m=>{if(m.isMesh&&(m.name===name||m.name.startsWith(name+'_')))parts.push(m);});}if(!parts.length)throw Error('Missing source nature prototype '+name);const group=new T.Group(),center=list.reduce((a,t)=>a.add(vec(t.p)),new T.Vector3()).multiplyScalar(1/list.length);for(const proto of parts){const inst=new T.InstancedMesh(proto.geometry,proto.material,list.length);inst.frustumCulled=false;inst.receiveShadow=true;inst.castShadow=false;list.forEach((tr,i)=>{obj.position.fromArray(tr.p);obj.quaternion.copy(basis).multiply(new T.Quaternion().setFromEuler(new T.Euler(...tr.r,'XYZ'))).multiply(ib);obj.scale.set(tr.s[0],tr.s[2],tr.s[1]);obj.updateMatrix();inst.setMatrixAt(i,obj.matrix);});inst.instanceMatrix.needsUpdate=true;group.add(inst);}this.root.add(group);this.natureChunks.push({group,center,count:list.length,range:/Fern|Shrub|Flora|Reed|Lil/i.test(name)?120:320,sphere:new T.Sphere(center,50)});}}
  const templates=ts.map(g=>{ns.bind(g.scene,true);g.scene.updateMatrixWorld(true);const meshes=[];g.scene.traverse(m=>{if(m.isMesh)meshes.push(m);});return meshes;});
  const types=this.trees.treeTypes,far=await ns.atlasMeshes(types);this.farBatches=types.map((type,i)=>{const m=far[i],inst=new T.InstancedMesh(m.geometry,m.material,this.trees.speciesCounts[type.typeId]);inst.frustumCulled=false;inst.instanceMatrix.setUsage(T.DynamicDrawUsage);this.root.add(inst);return[inst];});
  this.treeChunks=[];const chunks=new Map();for(const tr of this.trees.instances){const k=key(tr.position[0],tr.position[2],48)+'/'+tr.typeId;if(!chunks.has(k))chunks.set(k,[]);chunks.get(k).push(tr);}
  for(const list of chunks.values()){const ti=types.findIndex(t=>t.typeId===list[0].typeId),group=new T.Group(),avg=list.reduce((v,t)=>v.add(vec(t.position)),new T.Vector3()).multiplyScalar(1/list.length);for(const m of templates[ti]){const inst=new T.InstancedMesh(m.geometry,m.material,list.length);inst.frustumCulled=false;inst.castShadow=true;inst.receiveShadow=true;list.forEach((tr,i)=>{obj.position.fromArray(tr.position);obj.rotation.set(0,T.MathUtils.degToRad(tr.rotationYDeg),0);obj.scale.fromArray(tr.scale);obj.updateMatrix();inst.setMatrixAt(i,obj.matrix.clone().multiply(m.matrixWorld));});inst.instanceMatrix.needsUpdate=true;inst.userData.pcSourceMatrices=inst.instanceMatrix.array.slice();group.add(inst);}this.root.add(group);const matrices=new Float32Array(list.length*16);list.forEach((tr,i)=>{obj.position.fromArray(tr.position);obj.rotation.set(0,T.MathUtils.degToRad(tr.rotationYDeg),0);obj.scale.fromArray(tr.scale);obj.updateMatrix();obj.matrix.toArray(matrices,i*16);});this.treeChunks.push({group,center:avg,typeIndex:ti,matrices,count:list.length,trees:list,sphere:new T.Sphere(avg.clone().add(new T.Vector3(0,12,0)),54)});}
  await ns.ready();this.visualReady=true;return this;
 }
 update(camera,dt){if(!this.active||!this.visualReady)return;this._lodTime=(this._lodTime||0)-dt;if(this._lodTime>0)return;this._lodTime=.20;camera.updateMatrixWorld();const frustum=new T.Frustum().setFromProjectionMatrix(new T.Matrix4().multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse)),counts=[0,0,0,0,0];let visible=0,nearTrees=0,natureCount=0;
 const candidates=[];for(const c of this.treeChunks){const d=c.center.distanceTo(camera.position);c._show=(d<1650||camera.position.y>200)&&frustum.intersectsSphere(c.sphere);c._near=new Set();if(!c._show)continue;visible++;if(d<145)for(let i=0;i<c.count;i++){const m=i*16,ar=c.matrices,dist=Math.hypot(ar[m+12]-camera.position.x,ar[m+13]+8-camera.position.y,ar[m+14]-camera.position.z);if(dist<90)candidates.push({c,i,dist});}}
 candidates.sort((a,b)=>a.dist-b.dist);for(const x of candidates.slice(0,24))x.c._near.add(x.i);
 for(const c of this.treeChunks){c.group.visible=c._show&&c._near.size>0;if(!c._show)continue;let ni=0;for(let i=0;i<c.count;i++){const start=i*16;if(c._near.has(i)){for(const mesh of c.group.children)mesh.instanceMatrix.array.set(mesh.userData.pcSourceMatrices.subarray(start,start+16),ni*16);ni++;}else{for(const mesh of this.farBatches[c.typeIndex])mesh.instanceMatrix.array.set(c.matrices.subarray(start,start+16),counts[c.typeIndex]*16);counts[c.typeIndex]++;}}for(const mesh of c.group.children){mesh.count=ni;mesh.instanceMatrix.needsUpdate=true;mesh.instanceMatrix.updateRange.offset=0;mesh.instanceMatrix.updateRange.count=ni*16;}nearTrees+=ni;}

 this.farBatches.forEach((meshes,i)=>meshes.forEach(m=>{m.count=counts[i];m.visible=counts[i]>0;m.instanceMatrix.needsUpdate=true;m.instanceMatrix.updateRange.offset=0;m.instanceMatrix.updateRange.count=counts[i]*16;}));
 for(const c of this.natureChunks){c.group.visible=c.center.distanceTo(camera.position)<c.range&&frustum.intersectsSphere(c.sphere);if(c.group.visible)natureCount+=c.count;}
 if(this.lightContext){const{sun}=this.lightContext,dir=vec(this.native.spec.sun.direction),center=new T.Vector3(camera.position.x,this.height(camera.position.x,camera.position.z),camera.position.z);sun.position.copy(center).addScaledVector(dir,240);sun.target.position.copy(center);sun.target.updateMatrixWorld();}
 Object.assign(this.diagnostics,{visibleTreeChunks:visible,nearTrees,farTreeCount:counts.reduce((a,b)=>a+b,0),visibleNatureInstances:natureCount,treeLOD:'original geometry near / source-rendered multi-view far; no generic cones'});
 }
 drawMap(ctx,map,hole){
  const draw=(poly,color)=>{if(poly.length<3)return;ctx.beginPath();poly.forEach((p,i)=>{const m=map(p[0],p[1]);if(i)ctx.lineTo(m.mx,m.my);else ctx.moveTo(m.mx,m.my);});ctx.closePath();ctx.fillStyle=color;ctx.fill();};
  for(const s of this.surfaceList.slice().reverse())if(s.holeNumber===hole)draw(s.boundaryPolygonXZ,({green:'#6c9f69',fairway:'#416d50',bunker:'#d3be8c',tee:'#d9d1ae',fringe:'#608755'})[s.type]||'#466246');
  for(const h of this.water)draw(h.waterPolygonXZ,'#497f94');
 }
}
window.PuttClubCourse=new Course();window.PuttCourseReady=window.PuttClubCourse.prepare();
})();
