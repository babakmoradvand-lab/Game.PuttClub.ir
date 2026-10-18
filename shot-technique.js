/* Shot Setup 51. Deterministic reduced-order delivery model, NOT force-plate,
   TrackMan measurement or a replacement for the calibrated neutral game.
   Convention: positive face/path = right of target for either handedness.
   Feet and ball are metres; opening is degrees; timing is dimensionless.
   No distance bonuses or post-impact steering. All flight parameters freeze
   on the launch velocity and travel with preview/wind traces and the ball. */
(()=>{'use strict';
const T=THREE,clamp=T.MathUtils.clamp,rad=T.MathUtils.degToRad,deg=T.MathUtils.radToDeg;
const defaults=Object.freeze({face:0,width:1,leadStep:0,trailStep:0,leadFlare:0,trailFlare:0,ball:0,pressure:0,release:0,path:0});
const bounds=Object.freeze({face:[-8,8],width:[.90,1.10],leadStep:[-.035,.035],trailStep:[-.035,.035],leadFlare:[-12,12],trailFlare:[-12,12],ball:[-.045,.045],pressure:[-1,1],release:[-1,1],path:[-6,6]});
let states={},revision=0,lastImpact=null;
const smooth=(a,b,t)=>{const u=clamp((t-a)/(b-a),0,1);return u*u*(3-2*u)};
function clean(s={},putt=false){const o={};for(const [k,v]of Object.entries(defaults)){const x=Number(s[k]);o[k]=Number.isFinite(x)?clamp(x,...bounds[k]):v}if(putt){o.face=clamp(o.face,-3,3);o.pressure=o.release=o.path=0}return o}
function get(club={}){return clean(states[club.id]||defaults,club.isPutter||club.id==='PT')}
function active(s){return Object.keys(defaults).some(k=>Math.abs(s[k]-defaults[k])>1e-9)}
function set(club,patch){if(!club?.id)return;states[club.id]=clean({...get(club),...patch},club.isPutter);revision++;return get(club)}
function reset(club){if(club?.id)delete states[club.id];else states={};revision++}
function signature(club){return JSON.stringify(get(club))}
function exportState(){return {schema:1,clubs:JSON.parse(JSON.stringify(states))}}
function restore(data){states={};if(data?.schema===1&&data.clubs&&typeof data.clubs==='object')for(const [id,s]of Object.entries(data.clubs)){if(/^(1W|3W|5W|[4-9]I|PW|AW|SW|PT)$/.test(id))states[id]=clean(s,id==='PT')}revision++}
function pressureAt(t,s){const knots=[[0,.5],[.24,.4],[.40,.58],[.5,.76],[.75,.88],[1,.92]];let i=1;while(i<knots.length-1&&t>knots[i][0])i++;const a=knots[i-1],b=knots[i],u=smooth(a[0],b[0],t);return clamp(T.MathUtils.lerp(a[1],b[1],u)+s.pressure*.12*smooth(.12,.36,t)*(1-smooth(.52,.85,t)),.2,.96)}
function delivery(club,mode='full',s=get(club)){
 const putt=!!club.isPutter||club.id==='PT',wood=club.cat==='wood',wedge=club.cat==='wedge',radius=putt?.7:wood?1.15:.90;
 const baseAttack=putt?0:club.id==='1W'?2:wood?-2:wedge?-5:-4;
 const baseLow=-radius*Math.tan(rad(baseAttack)),pDelta=pressureAt(.5,s)-pressureAt(.5,defaults);
 // Stance axis is derived from the two real foot positions. The direct path
 // input is the simplified shoulder/swing direction control, not a foot bonus.
 const stanceWidth=(putt?.29:mode==='chip'?.29:wood?.46:.39)*s.width;
 const bodyYaw=deg(Math.atan2(s.leadStep-s.trailStep,stanceWidth));
 const path=putt?0:s.path+bodyYaw*.32;
 const lowPoint=baseLow+pDelta*.45;
 const attack=putt?0:deg(Math.atan((s.ball-lowPoint)/radius));
 const closure=putt?0:s.release*3.2;
 const face=s.face+closure;
 const loft=Number.isFinite(club.loft)?club.loft:putt?2.5:31.5;
 const dynamicLoft=putt?loft:clamp(loft+.65*(attack-baseAttack)-pDelta*8+s.release*1.5+deg(Math.atan(Math.tan(rad(loft))/Math.cos(rad(face))))-loft,2,67);
 const normal=(f,l)=>new T.Vector3(Math.cos(rad(l))*Math.cos(rad(f)),Math.sin(rad(l)),-Math.cos(rad(l))*Math.sin(rad(f)));
 const faceN=normal(face,dynamicLoft),pathN=normal(path,attack),baseN=normal(0,loft),baseV=normal(0,baseAttack);
 const spinLoft=deg(faceN.angleTo(pathN)),baseSpinLoft=deg(baseN.angleTo(baseV));
 const spinAxis=putt?0:Math.atan2(Math.sin(rad(face-path))*Math.cos(rad(attack)),Math.max(.08,Math.sin(rad(dynamicLoft-attack))));
 // Arc geometry locates the strike relative to the low point. Height error
 // changes contact quality/normal energy, rather than adding/subtracting yards.
 const heightError=putt?0:((s.ball-lowPoint)**2-baseLow**2)/(2*radius);
 const quality=putt?1:Math.exp(-((heightError/.024)**2)*.18);
 const compression=putt?1:clamp(Math.cos(rad(spinLoft))/Math.max(.3,Math.cos(rad(baseSpinLoft))),.65,1.12);
 const spinScale=putt?1:clamp(Math.sin(rad(spinLoft))/Math.max(.1,Math.sin(rad(baseSpinLoft)))*quality,.45,1.7);
 const speedScale=compression*quality;
 const faceWeight=putt?.95:clamp(.86-loft*.0018,.73,.86),start=faceWeight*face+(1-faceWeight)*path;
 const launchDelta=putt?0:.78*(dynamicLoft-loft)+.22*(attack-baseAttack);
 return Object.freeze({active:active(s),putt,faceAddress:s.face,faceImpact:face,path,bodyYaw,attack,dynamicLoft,spinLoft,baseSpinLoft,spinAxis,spinScale,speedScale,quality,heightError,lowPoint,launchDelta,start,closure,pressureFront:pressureAt(.5,s),state:Object.freeze({...s})});
}
function launch(base,club,mode,dir){const d=delivery(club,mode);if(!d.active)return base;
 const speed=base.length()*d.speedScale,h=Math.hypot(base.x,base.z),loft=d.putt?0:clamp(Math.atan2(base.y,h)+rad(d.launchDelta),rad(1),rad(70));
 const right=new T.Vector3(dir.z,0,-dir.x),horizontal=dir.clone().multiplyScalar(Math.cos(rad(d.start))).addScaledVector(right,Math.sin(rad(d.start))).normalize();
 const v=horizontal.multiplyScalar(speed*Math.cos(loft));v.y=speed*Math.sin(loft);v.shotImpact=d;return v;
}
function air(velocity,air,dt,lift){const d=velocity.shotImpact;if(!d?.active||d.putt)return;const speed=air.length(),h=Math.hypot(air.x,air.z);if(h<1e-5||speed<.01)return;
 // Tilt/scaling of the existing lift vector about the air-relative velocity.
 const old=lift*speed*speed,scale=d.spinScale,axis=d.spinAxis;
 const deltaUp=old*(scale*Math.cos(axis)-1),side=old*scale*Math.sin(axis);
 velocity.y+=deltaUp*h/speed*dt;
 const along=-deltaUp*air.y/speed*dt;velocity.x+=along*air.x/h+side*air.z/h*dt;velocity.z+=along*air.z/h-side*air.x/h*dt;
}
function terrain(velocity,normal){const d=velocity.shotImpact;if(!d?.active||d.putt)return;const vn=velocity.dot(normal);if(vn>=0)return;const n=normal.clone().multiplyScalar(vn),t=velocity.clone().sub(n),factor=clamp(1-.12*(d.spinScale*Math.cos(d.spinAxis)-1),.90,1.10);velocity.copy(n.add(t.multiplyScalar(factor)))}
function foot(club,side,f,q){const s=get(club);if(!active(s))return;f.z+=side==='L'?s.leadStep:s.trailStep;q.premultiply(new T.Quaternion().setFromAxisAngle(new T.Vector3(0,1,0),rad((side==='L'?1:-1)*(side==='L'?s.leadFlare:s.trailFlare))))}
function pose(athlete,m,t,anchor){if(athlete._setupProbe49)return null;const d=delivery(athlete.club,athlete.current);if(!d.active)return null;const s=d.state,Y=new T.Vector3(0,1,0),qPath=new T.Quaternion().setFromAxisAngle(Y,rad(d.path));
 const oldButt=m.hand.clone().addScaledVector(m.direction,-.055),oldContact=anchor.clone().applyQuaternion(m.rotation).add(oldButt);
 const deltaFace=s.face+d.closure*smooth(.35,.5,t),yaw=new T.Quaternion().setFromAxisAngle(Y,rad(deltaFace)),pitch=new T.Quaternion().setFromAxisAngle(new T.Vector3(0,0,1),rad(-(d.dynamicLoft-athlete.spec.loft))*smooth(.32,.5,t));
 m.hand.sub(athlete.ball).applyQuaternion(qPath).add(athlete.ball);m.direction.applyQuaternion(qPath);m.rotation.premultiply(qPath);
 // Opening/closure acts about the contact location: no shaft scaling or detached hands.
 const before=anchor.clone().applyQuaternion(m.rotation).add(m.hand.clone().addScaledVector(m.direction,-.055));m.rotation.premultiply(new T.Quaternion().setFromAxisAngle(Y,rad(deltaFace-d.path))).premultiply(pitch);m.direction.set(0,1,0).applyQuaternion(m.rotation);
 const after=anchor.clone().applyQuaternion(m.rotation).add(m.hand.clone().addScaledVector(m.direction,-.055));m.hand.add(before.sub(after));
 // The impact target is still on the real ball; arbitrary path edits cannot
 // translate that ball. Anchor/radius are reconciled below at exact impact.
 if(Math.abs(t-.5)<1e-7){const intended=athlete.ball.clone().addScaledVector(athlete.impactNormal.clone().applyQuaternion(yaw).applyQuaternion(pitch),-athlete.radius),now=anchor.clone().applyQuaternion(m.rotation).add(m.hand.clone().addScaledVector(m.direction,-.055));m.hand.add(intended.sub(now));athlete.contactTarget.copy(intended)}
 m.hip+=rad(d.bodyYaw)*.45*(1-smooth(.65,1,t));m.chest+=rad(d.bodyYaw)*(1-smooth(.65,1,t));m.shift+=(pressureAt(t,s)-pressureAt(t,defaults))*.10;athlete.techniqueDiagnostics=d;return d;
}
window.ShotTechnique={defaults,bounds,get,set,reset,signature,exportState,restore,pressureAt,delivery,launch,air,terrain,foot,pose,get revision(){return revision},get lastImpact(){return lastImpact},recordImpact(d){lastImpact=d?JSON.parse(JSON.stringify(d)):null}};
})();
