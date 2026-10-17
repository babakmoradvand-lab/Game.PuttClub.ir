/* Round weather + side-effect-free paired flight advice. Offline, no weather API. */
(() => {
'use strict';
const T=THREE,short=document.getElementById('wind-advice-short'),relative=document.getElementById('wind-relative'),impact=document.getElementById('wind-impact');
const MPH=.44704,YD=1/.9144;
let state=null,current={x:0,z:0,mph:0,angle:0,band:'calm'},shot=null,lastKey='',generation=0,sampleWait=0,radarWait=0,forecast=null;
const diagnostics={predictions:0,cancelled:0,lastMs:0};
function rng(seed){let s=seed>>>0;return()=>{s+=0x6D2B79F5;let t=s;t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);return((t^(t>>>14))>>>0)/4294967296;};}
function schedule(seed){const r=rng(seed),counts={strong:2+(r()>.5?1:0),medium:2+(r()>.5?1:0),low:2+(r()>.5?1:0)},bands=[];for(const k of ['strong','medium','low'])for(let i=0;i<counts[k];i++)bands.push(k);while(bands.length<18)bands.push('calm');for(let i=17;i>0;i--){const j=Math.floor(r()*(i+1));[bands[i],bands[j]]=[bands[j],bands[i]];}return bands.map(band=>({band,base:band==='strong'?12+r()*4:band==='medium'?5+r()*2.5:band==='low'?1+r():0,amplitude:band==='strong'?2+r()*2:band==='medium'?1+r():band==='low'?.3+r()*.3:0,angle:r()*Math.PI*2,phase:r()*Math.PI*2,period:45+r()*75}));}
function valueAt(hole,elapsed){const p=state.holes[hole-1],wave=Math.sin(elapsed*2*Math.PI/p.period+p.phase),mph=Math.max(0,p.base+p.amplitude*wave),angle=p.angle+Math.sin(elapsed*2*Math.PI/(p.period*1.7)+p.phase)*.18;return{x:Math.cos(angle)*mph*MPH,z:Math.sin(angle)*mph*MPH,mph,angle,band:p.band};}
function publish(){windAngle=current.angle;windSpeedMph=current.mph;updateWindDisplay();}
function invalidate(){lastKey='';generation++;forecast=null;}
function newRound(seed){seed=Number.isInteger(seed)?seed>>>0:(crypto.getRandomValues(new Uint32Array(1))[0]);state={schema:1,seed,holes:schedule(seed),elapsed:Array(18).fill(0),hole:1};sampleWait=0;radarWait=0;shot=null;current=valueAt(1,0);invalidate();publish();}
function enterHole(h){if(!state)newRound();state.hole=Math.max(1,Math.min(18,Math.round(h)));shot=null;current=valueAt(state.hole,state.elapsed[state.hole-1]);sampleWait=0;invalidate();publish();}
function exportState(){return JSON.parse(JSON.stringify({...state,current,shot}));}
function restore(saved,hole=1){
 if(!saved||saved.schema!==1||!Number.isInteger(saved.seed)||!Array.isArray(saved.elapsed)||saved.elapsed.length!==18||!saved.elapsed.every(x=>Number.isFinite(x)&&x>=0&&x<1e9)){newRound();enterHole(hole);return;}
 // Regenerate immutable profiles from the seed; never trust arbitrary saved forces.
 state={schema:1,seed:saved.seed>>>0,holes:schedule(saved.seed),elapsed:[...saved.elapsed],hole:Math.max(1,Math.min(18,Math.round(hole)||1))};shot=null;current=valueAt(state.hole,state.elapsed[state.hole-1]);
 const c=saved.current;if(saved.hole===state.hole&&c&&(state.holes[state.hole-1].band!=='calm'||c.mph===0)&&[c.x,c.z,c.mph,c.angle].every(Number.isFinite)&&c.mph>=0&&c.mph<=22&&Math.abs(Math.hypot(c.x,c.z)-c.mph*MPH)<1e-6&&Math.abs(c.x-Math.cos(c.angle)*c.mph*MPH)<1e-6&&Math.abs(c.z-Math.sin(c.angle)*c.mph*MPH)<1e-6)current={...c,band:state.holes[state.hole-1].band};
 sampleWait=0;invalidate();publish();
}
function physicsWind(){return shot||current;}
function captureShot(){shot=Object.freeze({...current});generation++;short.textContent='باد ضربه ثبت شد';impact.textContent='شرایط باد این ضربه تا پایان آن ثابت است.';return {...shot};}
function directionText(){const d=aimDirection,along=current.x*d.x+current.z*d.z,cross=-current.x*d.z+current.z*d.x;if(current.mph<.05)return'آرام · بدون باد';const words=[];if(Math.abs(along)>.15)words.push(along>0?'موافق ضربه':'مخالف ضربه');if(Math.abs(cross)>.15)words.push(cross>0?'از چپ به راست':'از راست به چپ');return words.join(' · ')||'باد بسیار ضعیف';}
function signature(){return JSON.stringify([window.activeCourseId,currentHoleNumber,ballPos.toArray(),aimDirection.toArray(),currentClubIndex,currentSwingMode,swingPowerPercent,document.getElementById('putter-backswing-slider').value,current.x,current.z,courseBallPlugged]);}
function makeTrace(wind){return{p:ballPos.clone().add(new T.Vector3(0,.05,0)),v:getShotLaunchVelocity(calculateShotSpecs(currentClubIndex,currentSwingMode,swingPowerPercent)),origin:ballPos.clone(),wind:{x:wind.x,z:wind.z},t:0,peak:ballPos.y,done:false,contact:null,wet:false};}
function advance(trace,n=80){const dt=1/120;for(let j=0;j<n&&!trace.done;j++){
 const previous=trace.p.clone();stepBallFlight(trace.p,trace.v,dt,true,trace.wind);trace.t+=dt;trace.peak=Math.max(trace.peak,trace.p.y);
 const wet=isPuttClub()?window.PuttClubCourse.wetAt(trace.p):null,ground=wet?wet.waterLevelY+BALL_RADIUS:getTerrainHeight(trace.p.x,trace.p.z)+BALL_RADIUS;
 if(trace.p.y<=ground){let lo=0,hi=1;for(let k=0;k<12;k++){const mid=(lo+hi)/2,p=previous.clone().lerp(trace.p,mid),level=wet?ground:getTerrainHeight(p.x,p.z)+BALL_RADIUS;if(p.y>level)lo=mid;else hi=mid;}trace.p.copy(previous.lerp(trace.p,hi));trace.p.y=wet?ground:getTerrainHeight(trace.p.x,trace.p.z)+BALL_RADIUS;trace.contact=trace.p.clone();trace.wet=!!wet;trace.done=true;}
 if(trace.t>=25||!trace.p.toArray().every(Number.isFinite))trace.done=true;
 }return trace.done;}
async function compute(key,token){const started=performance.now(),d=aimDirection.clone(),wind={...current},withWind=makeTrace(wind),calm=makeTrace({x:0,z:0});
 while(!withWind.done||!calm.done){if(token!==generation){diagnostics.cancelled++;return null;}advance(withWind);advance(calm);await new Promise(resolve=>setTimeout(resolve,0));}
 if(token!==generation)return null;
 if(!withWind.contact||!calm.contact){impact.textContent='پیش‌بینی این پرواز در محدودهٔ محاسبه کامل نشد.';short.textContent='اثر باد · نامشخص';return null;}
 const delta=withWind.contact.clone().sub(calm.contact),carry=(withWind.contact.clone().sub(withWind.origin).setY(0).length()-calm.contact.clone().sub(calm.origin).setY(0).length())*YD,lateral=(-delta.x*d.z+delta.z*d.x)*YD,magnitude=Math.max(Math.abs(carry),Math.abs(lateral));
 forecast={key,wind,carryYards:carry,lateralYards:lateral,withWind:{point:withWind.contact.toArray(),airtime:withWind.t,apex:withWind.peak-withWind.origin.y,water:withWind.wet},calm:{point:calm.contact.toArray(),airtime:calm.t,apex:calm.peak-calm.origin.y,water:calm.wet},level:magnitude>=8?'زیاد':magnitude>=3?'متوسط':magnitude>=.3?'کم':'ناچیز'};
 const num=n=>Math.abs(n)<.05?'۰':Math.abs(n).toLocaleString('fa-IR',{maximumFractionDigits:1});
 short.textContent=`اثر باد: ${forecast.level}`;
 impact.textContent=`کری ${num(carry)} یارد ${carry<0?'کمتر':'بیشتر'} · جابه‌جایی جانبی ${num(lateral)} یارد ${lateral<0?'چپ':'راست'}${withWind.wet||calm.wet?' · یکی از مسیرها به آب می‌رسد':''}`;
 diagnostics.predictions++;diagnostics.lastMs=performance.now()-started;return forecast;
}
function refresh(force=false){if(!state||document.body.dataset.view!=='game'||!canAdjustAim())return null;
 const text=directionText();relative.textContent=`باد ${current.mph.toLocaleString('fa-IR',{maximumFractionDigits:1})} mph · ${text}`;
 const key=signature();if(!force&&key===lastKey)return null;lastKey=key;const token=++generation;
 if(GOLF_BAG[currentClubIndex].isPutter){forecast={key,wind:{...current},carryYards:0,lateralYards:0,level:'صفر',putt:true};short.textContent='پات · اثر باد صفر';impact.textContent='در مدل فعلی، باد روی حرکت زمینی پات اعمال نمی‌شود؛ شیب و قدرت تعیین‌کننده‌اند.';return Promise.resolve(forecast);}
 if(current.mph<.05){forecast={key,wind:{...current},carryYards:0,lateralYards:0,level:'صفر'};short.textContent='آرام · اثر باد صفر';impact.textContent='باد این حفره صفر است؛ اختلاف با شبیه‌سازی بدون باد نیز صفر است.';return Promise.resolve(forecast);}
 short.textContent='اثر باد · در حال محاسبه';impact.textContent='مقایسهٔ همین تنظیمات با باد و بدون باد…';return compute(key,token);
}
function tick(dt){if(document.body.dataset.view!=='game'||!state)return;state.elapsed[state.hole-1]+=Math.max(0,Math.min(.1,dt));radarWait+=dt;if(current.mph>.05&&!sceneMotionPreference.matches&&document.body.dataset.reducedMotion!=='true'&&radarWait>=.125&&getComputedStyle(minimapCanvas).display!=='none'){radarWait=0;drawMinimap();}if(!canAdjustAim())return;if(shot){shot=null;sampleWait=1;}sampleWait+=dt;if(sampleWait>=1){sampleWait=0;current=valueAt(state.hole,state.elapsed[state.hole-1]);publish();if(!window.GreenReader?.enabled)updateAimTracer();drawMinimap();}refresh();}
function paint(ctx,w,h){if(current.mph<.05)return;ctx.save();ctx.globalAlpha=.58;ctx.strokeStyle='#f0e5ca';ctx.lineWidth=1;const ux=Math.cos(current.angle),uy=Math.sin(current.angle),motion=sceneMotionPreference.matches||document.body.dataset.reducedMotion==='true'?0:Math.sin(state.elapsed[state.hole-1]*.65)*2;
 for(const [x,y]of[[w-39,19],[w-53,31],[w-31,43]]){const cx=x+ux*motion,cy=y+uy*motion,l=8;ctx.beginPath();ctx.moveTo(cx-ux*l,cy-uy*l);ctx.lineTo(cx+ux*l,cy+uy*l);ctx.lineTo(cx+ux*l-ux*4+uy*3,cy+uy*l-uy*4-ux*3);ctx.moveTo(cx+ux*l,cy+uy*l);ctx.lineTo(cx+ux*l-ux*4-uy*3,cy+uy*l-uy*4+ux*3);ctx.stroke();}ctx.restore();}
window.WindSystem={newRound,enterHole,restore,exportState,physicsWind,captureShot,tick,paint,refresh,schedule,get current(){return {...current};},get forecast(){return forecast?JSON.parse(JSON.stringify(forecast)):null;},diagnostics};newRound();
})();
