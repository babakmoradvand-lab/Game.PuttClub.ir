/* Green Atelier — on-demand terrain reading. No trajectory prediction, aim or
   physics changes. Static, bounded geometry is rebuilt only per course/hole. */
(() => {
'use strict';
const T=THREE,button=document.getElementById('btn-read-green'),legend=document.getElementById('green-read-legend');
const group=new T.Group();group.name='GreenAtelier';group.visible=false;scene.add(group);
const ink=new T.LineBasicMaterial({color:0xf1edda,transparent:true,opacity:.38,depthWrite:false});
const gold=new T.LineBasicMaterial({color:0xddc594,transparent:true,opacity:.72,depthWrite:false});
let enabled=false,cacheKey='',stateKey='',interval=.1;
const diagnostics={builds:0,arrows:0,segments:0,buildMs:0,intervalM:.1};
const fmt=(n,d=0)=>Number(n).toLocaleString('fa-IR',{maximumFractionDigits:d});
function key(){return (window.activeCourseId||'mis')+':'+currentHoleNumber;}
function allowed(){return !!GOLF_BAG[currentClubIndex]?.isPutter&&canAdjustAim()&&document.body.dataset.view==='game';}
function close(){enabled=false;group.visible=false;legend.hidden=true;button.setAttribute('aria-pressed','false');document.body.dataset.greenRead='false';}
function context(){
 const pin=holePins3D[currentHoleNumber];if(!pin)return null;
 if(isPuttClub()){
  const pc=window.PuttClubCourse,s=pc.surfaceList.find(s=>s.type==='green'&&s.holeNumber===currentHoleNumber);if(!s)return null;
  return{pin,b:s.bbox,offset:.035,inside:(x,z)=>{const a=pc.surface(x,z);return a.type==='green'&&a.holeNumber===currentHoleNumber;}};
 }
 const c=brownCenters3D[currentHoleNumber]||pin;
 return{pin,b:[c.x-11,c.z-11,c.x+11,c.z+11],offset:.315,inside:(x,z)=>(x-c.x)**2+(z-c.z)**2<121};
}
function slope(x,z){const e=.35;return[(getTerrainHeight(x+e,z)-getTerrainHeight(x-e,z))/(2*e),(getTerrainHeight(x,z+e)-getTerrainHeight(x,z-e))/(2*e)];}
function build(){
 const ctx=context();if(!ctx)return false;
 const start=performance.now();while(group.children.length){const a=group.children[0];group.remove(a);a.geometry.dispose();}
 const [x0,z0,x1,z1]=ctx.b,step=Math.max(.65,(x1-x0)/72,(z1-z0)/72),nx=Math.ceil((x1-x0)/step),nz=Math.ceil((z1-z0)/step),dx=(x1-x0)/nx,dz=(z1-z0)/nz,grid=[];
 let lo=Infinity,hi=-Infinity;
 for(let j=0;j<=nz;j++){const row=[];for(let i=0;i<=nx;i++){const x=x0+i*dx,z=z0+j*dz,h=getTerrainHeight(x,z);row.push({x,z,h});if(ctx.inside(x,z)){lo=Math.min(lo,h);hi=Math.max(hi,h);}}grid.push(row);}
 if(!Number.isFinite(lo))return false;
 interval=hi-lo<=.4?.05:hi-lo<=1.5?.1:.25;
 const fine=[],major=[],arrows=[];let arrowCount=0;
 const inside=(x,z)=>ctx.inside(x,z)&&Math.hypot(x-ctx.pin.x,z-ctx.pin.z)>.20;
 const vertex=(arr,x,z)=>arr.push(x,getTerrainHeight(x,z)+ctx.offset,z);
 function segment(arr,a,b){
  const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/.35));
  for(let k=0;k<n;k++){const u=k/n,v=(k+1)/n,ax=T.MathUtils.lerp(a.x,b.x,u),az=T.MathUtils.lerp(a.z,b.z,u),bx=T.MathUtils.lerp(a.x,b.x,v),bz=T.MathUtils.lerp(a.z,b.z,v);
   if(inside(ax,az)&&inside(bx,bz)&&inside((ax+bx)/2,(az+bz)/2)){vertex(arr,ax,az);vertex(arr,bx,bz);}}
 }
 function triangle(v){
  const min=Math.min(...v.map(p=>p.h)),max=Math.max(...v.map(p=>p.h));
  for(let k=Math.ceil(min/interval);k*interval<=max;k++){
   const level=k*interval,pts=[];
   for(let i=0;i<3;i++){const a=v[i],b=v[(i+1)%3];if((a.h<level)!==(b.h<level)){const t=(level-a.h)/(b.h-a.h);pts.push({x:T.MathUtils.lerp(a.x,b.x,t),z:T.MathUtils.lerp(a.z,b.z,t)});}}
   if(pts.length===2)segment(k%5===0?major:fine,pts[0],pts[1]);
  }
 }
 for(let j=0;j<nz;j++)for(let i=0;i<nx;i++){const a=grid[j][i],b=grid[j][i+1],c=grid[j+1][i+1],d=grid[j+1][i];triangle([a,b,c]);triangle([a,c,d]);}
 const spacing=Math.max(2.6,Math.max(x1-x0,z1-z0)/12);
 for(let z=z0+spacing/2;z<z1;z+=spacing)for(let x=x0+spacing/2;x<x1;x+=spacing){
  if(!inside(x,z)||Math.hypot(x-ctx.pin.x,z-ctx.pin.z)<.8)continue;
  const[gx,gz]=slope(x,z),g=Math.hypot(gx,gz);if(g<.0015)continue;
  const ux=-gx/g,uz=-gz/g,len=.55,tip={x:x+ux*len/2,z:z+uz*len/2},tail={x:x-ux*len/2,z:z-uz*len/2};
  if(!inside(tip.x,tip.z)||!inside(tail.x,tail.z))continue;
  segment(arrows,tail,tip);segment(arrows,tip,{x:tip.x-ux*.20-uz*.14,z:tip.z-uz*.20+ux*.14});segment(arrows,tip,{x:tip.x-ux*.20+uz*.14,z:tip.z-uz*.20-ux*.14});arrowCount++;
 }
 for(const[arr,mat]of [[fine,ink],[major,gold],[arrows,gold]]){const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(arr,3));const lines=new T.LineSegments(geo,mat);lines.renderOrder=8;group.add(lines);}
 Object.assign(diagnostics,{builds:diagnostics.builds+1,arrows:arrowCount,segments:(fine.length+major.length+arrows.length)/6,buildMs:performance.now()-start,intervalM:interval,course:window.activeCourseId,hole:currentHoleNumber,grid:[nx,nz],heightRangeM:hi-lo});
 cacheKey=key();return true;
}
function readout(){
 const pin=holePins3D[currentHoleNumber],s=slope(ballPos.x,ballPos.z),grade=Math.hypot(...s)*100,rise=(getTerrainHeight(pin.x,pin.z)-getTerrainHeight(ballPos.x,ballPos.z))*100;
 document.getElementById('green-read-local').textContent=grade<.15?'سطح این نقطه تقریباً تخت است':`شیب محل توپ · ${fmt(grade,1)}٪`;
 document.getElementById('green-read-rise').textContent=Math.abs(rise)<1?'ارتفاع حفره تقریباً هم‌سطح توپ است':`حفره ${fmt(Math.abs(rise))} سانتی‌متر ${rise>0?'بالاتر':'پایین‌تر'} از توپ`;
 document.getElementById('green-read-key').textContent=`فاصلهٔ خطوط ${fmt(interval*100)} سانتی‌متر · پیکان‌ها رو به سرازیری‌اند؛ مسیر پیشنهادی ضربه نیست.`;
}
function sync(){const next=key();if(!GOLF_BAG[currentClubIndex]?.isPutter||next!==stateKey)close();stateKey=next;}
button.addEventListener('click',()=>{if(enabled){close();return;}if(!allowed())return;if(cacheKey!==key()&&!build())return;readout();enabled=true;group.visible=true;legend.hidden=false;button.setAttribute('aria-pressed','true');document.body.dataset.greenRead='true';});
window.GreenReader={sync,close,diagnostics,get enabled(){return enabled;},group};sync();
})();
