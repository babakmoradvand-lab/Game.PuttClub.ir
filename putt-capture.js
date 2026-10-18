/* PuttClub44: swept disk/cup overlap + bounded native rolling runout.
 * Applies only to putts; never enlarges the physical cup or attracts a near miss.
 * Native cup radius 54mm; legacy visible cup radius 120mm; ball radius is native.
 */
(()=>{'use strict';const C=Object.freeze({cupRadius:.054,legacyCupRadius:.12,fullRunout:.9144,halfRunout:.15,halfOverlap:.5});
function overlap(d,r,R=C.cupRadius){if(d+r<=R)return 1;if(d>=R+r)return 0;if(d+R<=r)return R*R/(r*r);const a=Math.acos(Math.max(-1,Math.min(1,(d*d+r*r-R*R)/(2*d*r)))),b=Math.acos(Math.max(-1,Math.min(1,(d*d+R*R-r*r)/(2*d*R)))),q=Math.sqrt(Math.max(0,(-d+r+R)*(d+r-R)*(d-r+R)*(d+r+R)));return (r*r*a+R*R*b-.5*q)/(Math.PI*r*r);}
function sweep(from,to,pin){const dx=to.x-from.x,dz=to.z-from.z,den=dx*dx+dz*dz,u=den?Math.max(0,Math.min(1,((pin.x-from.x)*dx+(pin.z-from.z)*dz)/den)):0,x=from.x+dx*u,z=from.z+dz*u;return{x,z,u,distance:Math.hypot(x-pin.x,z-pin.z)};}
// Identical arithmetic to existing native/legacy ground velocity updates.
function rollVelocity(v,dt,n,surface,club,legacy,mode,g=9.81){let decel,ax,az;if(!legacy){decel=surface.type==='green'?.48:surface.type==='fringe'?.95:surface.type==='bunker'?1.6*(surface.physicsBehavior?.rollFrictionMultiplier||4.5):surface.type==='heavy_rough'?5:surface.type==='rough'?3:1.6;ax=n.x*n.y*g*5/7;az=n.z*n.y*g*5/7;}else{decel=club.rollDecel!==undefined?club.rollDecel:1.6;if(surface.type==='Rough')decel*=1.85;else if(surface.type==='Green')decel=2.4;if(mode==='chip')decel*=1.25;ax=n.x*g*1.35;az=n.z*g*1.35;}
 v.x+=ax*dt;v.z+=az*dt;v.y=0;const speed=Math.hypot(v.x,v.z),loss=decel*dt;if(speed>loss){v.x*=1-loss/speed;v.z*=1-loss/speed;}else if(Math.hypot(ax,az)<decel*(legacy?.85:1)){v.x=0;v.z=0;}return {decel,slope:Math.hypot(ax,az)};}
function forecast(position,velocity,budget,field,stepDt,club,legacy,mode){const p={x:position.x,y:position.y,z:position.z},v={x:velocity.x,y:0,z:velocity.z},dt=Math.max(1/1200,Math.min(1/60,stepDt||1/360)),frameDt=dt*6;let travel=0,settled=false,restTimer=0;
 for(let frame=0;frame<Math.ceil(16/frameDt);frame++){
  for(let k=0;k<6;k++){const sample=field(p.x,p.z);if(!sample||sample.hazard)return{stops:false,travel,reason:'hazard'};const r=rollVelocity(v,dt,sample.normal,sample.surface,club,legacy,mode),dx=v.x*dt,dz=v.z*dt;p.x+=dx;p.z+=dz;travel+=Math.hypot(dx,dz);if(travel>budget+1e-9)return{stops:false,travel,reason:'over-budget'};const speed=Math.hypot(v.x,v.z);if(speed<.0001&&r.slope<r.decel*(legacy?.85:1))return{stops:true,travel,position:p,reason:'rest'};if(speed<(legacy?.05:.035)&&(!legacy||r.slope<r.decel*.9)){settled=true;break;}}
  if(settled){restTimer+=frameDt;if(restTimer>(legacy?1.2:.65))return{stops:true,travel,position:p,reason:'settled'};}
 }
 return{stops:false,travel,reason:'no-rest'};
}
function evaluate(from,to,pin,velocity,radius,field,dt,club={},legacy=false,mode='putt',cupRadius=C.cupRadius){
 if(!pin||!Number.isFinite(velocity.x+velocity.z)||to.y>pin.y+radius+.06||Math.abs(velocity.y)>.2)return{capture:false,reason:'height-or-velocity'};
 const near=sweep(from,to,pin),fraction=overlap(near.distance,radius,cupRadius);if(fraction<C.halfOverlap-1e-10)return{capture:false,reason:'no-overlap',overlap:fraction};
 const full=near.distance+radius<=cupRadius+1e-10,allowance=full?C.fullRunout:C.halfRunout,speed=Math.hypot(velocity.x,velocity.z),dx=speed>1e-9?velocity.x/speed:1,dz=speed>1e-9?velocity.z/speed:0,along=(pin.x-near.x)*dx+(pin.z-near.z)*dz,lateral2=Math.max(0,(pin.x-near.x)**2+(pin.z-near.z)**2-along*along),farRim=Math.max(0,along+Math.sqrt(Math.max(0,cupRadius*cupRadius-lateral2))),budget=allowance+farRim;
 const pred=forecast({x:near.x,y:to.y,z:near.z},velocity,budget,field,dt,club,legacy,mode),beyond=Math.max(0,pred.travel-farRim);
 // Full overlap is strictly less than one yard. Half overlap is <=15cm.
 const capture=pred.stops&&(full?beyond<C.fullRunout-1e-9:beyond<=C.halfRunout+1e-9);
 return{capture,reason:capture?(full?'full-under-one-yard':'half-within-15cm'):pred.reason,overlap:fraction,full,allowance,farRim,travel:pred.travel,beyond,forecastStops:pred.stops};
}
let last=null;function check(from,to,pin,dt){const legacy=!isPuttClub(),club=GOLF_BAG[currentClubIndex]||{},field=(x,z)=>{if(legacy)return{normal:getTerrainNormal(x,z),surface:detectLie(new THREE.Vector3(x,getTerrainHeight(x,z)+BALL_RADIUS,z))};const pc=window.PuttClubCourse,info=pc.height(x,z,true);return{normal:info.normal,surface:pc.surface(x,z),hazard:!!pc.wetAt(new THREE.Vector3(x,info.y+BALL_RADIUS,z))};};last=evaluate(from,to,pin,ballVel,BALL_RADIUS,field,dt,club,legacy,currentSwingMode,legacy?C.legacyCupRadius:C.cupRadius);return last.capture;}
const api={config:C,overlap,sweep,rollVelocity,forecast,evaluate,check,get diagnostics(){return last;}};if(typeof window!=='undefined')window.PuttCapture=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})();
