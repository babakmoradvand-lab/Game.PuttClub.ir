/* Green Atelier inspection: independent camera, real surface gradients, no aim/physics edits. */
(() => {
'use strict';
const T=THREE,button=document.getElementById('btn-read-green'),courseButton=document.getElementById('btn-read-course'),legend=document.getElementById('green-read-legend'),toolbar=document.getElementById('green-read-toolbar'),back=document.getElementById('btn-read-return');
const group=new T.Group();group.name='GreenAtelier';group.visible=false;scene.add(group);
const ink=new T.LineBasicMaterial({color:0xf1edda,transparent:true,opacity:.38,depthWrite:false});
const gold=new T.LineBasicMaterial({color:0xddc594,transparent:true,opacity:.72,depthWrite:false});
const readCamera=new T.PerspectiveCamera(42,1,.1,80000);readCamera.up.set(0,0,-1);
const marker=new T.Mesh(new T.RingGeometry(.38,.51,24),new T.MeshBasicMaterial({color:0xf0dca6,side:T.DoubleSide,depthTest:false,transparent:true,opacity:.95}));marker.rotation.x=-Math.PI/2;marker.renderOrder=12;marker.visible=false;scene.add(marker);
let enabled=false,cacheKey='',stateKey='',interval=.1,snapshot=null,selected=null,returnFocus=null;
const diagnostics={builds:0,arrows:0,segments:0,buildMs:0,intervalM:.1,mode:'shot',selection:null};
const view={mode:'green',yaw:0,pitch:1.30,zoom:1,panX:0,panZ:0};
const originTag=document.getElementById('read-origin-tag'),originCopy=document.getElementById('read-origin-copy'),originArrow=document.getElementById('read-origin-arrow');
const origins=new T.Group();origins.name='ReadActualBallAndIncoming';origins.visible=false;scene.add(origins);
const actualBall=new T.Mesh(new T.RingGeometry(.15,.21,28),new T.MeshBasicMaterial({color:0xf6dfaa,side:T.DoubleSide,depthTest:false}));actualBall.rotation.x=-Math.PI/2;actualBall.renderOrder=16;origins.add(actualBall);
const incoming=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({color:0xf1d7a0,transparent:true,opacity:.72,depthTest:false,depthWrite:false}));incoming.renderOrder=15;origins.add(incoming);
let focus=new T.Vector3(),radius=30;
function nearPlayer(){const c=context();if(!c)return false;const[x0,z0,x1,z1]=c.b;return Math.hypot(Math.max(x0-ballPos.x,0,ballPos.x-x1),Math.max(z0-ballPos.z,0,ballPos.z-z1))<18;}
function originGeometry(){const c=context();if(!c)return;actualBall.position.copy(ballPos);actualBall.position.y+=.04;const end=selected||{x:(c.b[0]+c.b[2])/2,z:(c.b[1]+c.b[3])/2},d=new T.Vector2(end.x-ballPos.x,end.z-ballPos.z),length=d.length();d.normalize();const start={x:end.x-d.x*Math.min(12,length),z:end.z-d.y*Math.min(12,length)},arr=[];
 const add=(a,b)=>{for(const q of [a,b])arr.push(q.x,getTerrainHeight(q.x,q.z)+c.offset+.04,q.z);};for(let i=0;i<20;i+=2)add({x:T.MathUtils.lerp(start.x,end.x,i/20),z:T.MathUtils.lerp(start.z,end.z,i/20)},{x:T.MathUtils.lerp(start.x,end.x,(i+1)/20),z:T.MathUtils.lerp(start.z,end.z,(i+1)/20)});for(const sign of [-1,1])add(end,{x:end.x-d.x*.75+d.y*.4*sign,z:end.z-d.y*.75-d.x*.4*sign});incoming.geometry.dispose();incoming.geometry=new T.BufferGeometry();incoming.geometry.setAttribute('position',new T.Float32BufferAttribute(arr,3));
}
function tick(){if(!enabled)return;const f=diagnostics.safeFrame;if(!f)return;const q=ballPos.clone().add(new T.Vector3(0,.12,0)),p=q.clone().project(readCamera),px=(p.x+1)*innerWidth/2,py=(1-p.y)*innerHeight/2,left=f.left+76,right=innerWidth-f.right-76,top=f.top+24,bottom=innerHeight-f.bottom-24,inside=p.z>-1&&p.z<1&&px>=f.left&&px<=innerWidth-f.right&&py>=f.top&&py<=innerHeight-f.bottom;
 let x=T.MathUtils.clamp(px,left,right),y=T.MathUtils.clamp(py,top,bottom);const dx=px-innerWidth/2,dy=py-innerHeight/2;originArrow.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI+90}deg)`;originArrow.hidden=inside;originTag.style.left=x+'px';originTag.style.top=y+'px';originTag.dataset.offscreen=String(!inside);const d=Math.hypot(ballPos.x-context().pin.x,ballPos.z-context().pin.z)/.9144,text=(inside?'توپ و بازیکن':'توپ و بازیکن، بیرون کادر')+' · '+fmt(d)+' یارد تا حفره';if(originCopy.textContent!==text)originCopy.textContent=text;diagnostics.origin={world:ballPos.toArray(),screen:[px,py],label:[x,y],offscreen:!inside,distanceYards:d};
}
const fmt=(n,d=0)=>Number(n).toLocaleString('fa-IR',{maximumFractionDigits:d});
function key(){return (window.activeCourseId||'mis')+':'+currentHoleNumber;}
function allowed(){return canAdjustAim()&&document.body.dataset.view==='game'&&!document.querySelector('.game-panel:not([hidden])')&&!document.getElementById('game-ui').inert;}
function capture(){return{position:camera.position.clone(),quaternion:camera.quaternion.clone(),up:camera.up.clone(),zoom:camera.zoom,fov:camera.fov,view:camera.view?{...camera.view}:null,width:innerWidth,height:innerHeight,target:orbitControls.target.clone(),targetPos:targetCameraPos.clone(),targetLook:targetOrbitTarget.clone(),follow:cameraFollowLook.clone(),transition:isCameraTransitioning,orbit:orbitControls.enabled,desktop:{...gameplayView},visible:[golferGroup,aimLine,ballMarker,landingRing,skyBeaconGroup].map(o=>[o,o.visible])};}
function close(restore=true){
 if(!enabled)return;enabled=false;group.visible=false;origins.visible=false;originTag.hidden=true;marker.visible=false;legend.hidden=true;toolbar.hidden=true;button.setAttribute('aria-pressed','false');courseButton.setAttribute('aria-pressed','false');document.body.dataset.greenRead='false';
 if(snapshot){for(const[o,v]of snapshot.visible)o.visible=v;if(restore){camera.position.copy(snapshot.position);camera.quaternion.copy(snapshot.quaternion);camera.up.copy(snapshot.up);camera.zoom=snapshot.zoom;camera.fov=snapshot.fov;if(innerWidth===snapshot.width&&innerHeight===snapshot.height)camera.view=snapshot.view?{...snapshot.view}:null;camera.updateProjectionMatrix();camera.updateMatrixWorld(true);orbitControls.target.copy(snapshot.target);targetCameraPos.copy(snapshot.targetPos);targetOrbitTarget.copy(snapshot.targetLook);cameraFollowLook.copy(snapshot.follow);isCameraTransitioning=snapshot.transition;orbitControls.enabled=snapshot.orbit;Object.assign(gameplayView,snapshot.desktop);}}
 if(restore&&snapshot&&!snapshot.transition&&canAdjustAim())updateAimTracer();snapshot=null;touches.clear();diagnostics.mode='shot';if(restore&&returnFocus?.isConnected&&!returnFocus.closest('[hidden]'))returnFocus.focus({preventScroll:true});
}
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
 Object.assign(diagnostics,{builds:diagnostics.builds+1,arrows:arrowCount,segments:(fine.length+major.length+arrows.length)/6,buildMs:performance.now()-start,intervalM:interval,course:window.activeCourseId,hole:currentHoleNumber,grid:[nx,nz],heightRangeM:hi-lo,low:lo,high:hi});
 cacheKey=key();return true;
}
function fit(reset=false){if(!enabled)return;const c=context();if(!c)return;
 if(reset){Object.assign(view,{mode:'green',yaw:Math.atan2(ballPos.x-(c.b[0]+c.b[2])/2,ballPos.z-(c.b[1]+c.b[3])/2),pitch:1.30,zoom:1,panX:0,panZ:0});}
 const w=innerWidth,h=innerHeight,landscape=h<460&&w>600,top=landscape?12:Math.max(76,toolbar.getBoundingClientRect().bottom+10),bottom=landscape?12:Math.min(h*.40,legend.getBoundingClientRect().height+24),left=landscape?toolbar.getBoundingClientRect().width+24:16,right=landscape?legend.getBoundingClientRect().width+24:16;
 let b=c.b.slice(),lo=diagnostics.low||0,hi=diagnostics.high||0;const include=(x,z,pad=2)=>{b[0]=Math.min(b[0],x-pad);b[1]=Math.min(b[1],z-pad);b[2]=Math.max(b[2],x+pad);b[3]=Math.max(b[3],z+pad);};
 if(view.mode==='course'){const cb=getCourseOverviewBounds();b=[cb.min.x,cb.min.z,cb.max.x,cb.max.z];lo=cb.min.y;hi=cb.max.y;}
 else if(view.mode==='player'||nearPlayer()){include(ballPos.x,ballPos.z);include(golferGroup.position.x,golferGroup.position.z);lo=Math.min(lo,ballPos.y-1);hi=Math.max(hi,ballPos.y+2.1);}
 focus.set((b[0]+b[2])/2,(lo+hi)/2,(b[1]+b[3])/2);readCamera.aspect=w/h;readCamera.zoom=1;readCamera.up.set(0,1,0);readCamera.setViewOffset(w,h,Math.round((right-left)/2),Math.round((bottom-top)/2),w,h);readCamera.updateProjectionMatrix();
 const corners=[];for(const x of [b[0],b[2]])for(const z of [b[1],b[3]])for(const y of [lo,hi])corners.push(new T.Vector3(x,y,z));
 const place=(r,pitch=view.pitch)=>{readCamera.position.copy(focus).add(new T.Vector3(Math.sin(view.yaw)*Math.cos(pitch)*r,Math.sin(pitch)*r,Math.cos(view.yaw)*Math.cos(pitch)*r));readCamera.lookAt(focus);readCamera.updateMatrixWorld(true);};
 radius=8;for(let i=0;i<100;i++){place(radius);if(corners.every(c=>{const p=c.clone().project(readCamera),x=(p.x+1)*w/2,y=(1-p.y)*h/2;return p.z>-1&&p.z<1&&x>=left+8&&x<=w-right-8&&y>=top+8&&y<=h-bottom-8;}))break;radius*=1.14;}
 const zoomOut=T.MathUtils.smoothstep(Math.log(Math.max(1,.3/view.zoom)),0,Math.log(60));if(zoomOut&&view.mode!=='course'){const cb=getCourseOverviewBounds();focus.lerp(cb.min.clone().add(cb.max).multiplyScalar(.5),zoomOut);}
 focus.x+=view.panX;focus.z+=view.panZ;radius=Math.min(20000,radius/view.zoom);place(radius,T.MathUtils.lerp(view.pitch,Math.PI/2-.025,zoomOut));
 diagnostics.safeFrame={top,bottom,left,right,width:w,height:h};diagnostics.view={...view};diagnostics.radius=radius;diagnostics.frameBounds=b;diagnostics.nearPlayer=nearPlayer();tick();
}
function mode(name){if(!enabled)return false;Object.assign(view,{mode:name,zoom:1,panX:0,panZ:0});if(name==='course')view.pitch=Math.PI/2-.025;fit(false);return true;}
function rotate(yaw,pitch=0){view.yaw=Math.atan2(Math.sin(view.yaw+yaw),Math.cos(view.yaw+yaw));view.pitch=T.MathUtils.clamp(view.pitch+pitch,.60,Math.PI/2-.025);fit(false);}
function pan(dx,dy){const scale=2*radius*Math.tan(T.MathUtils.degToRad(readCamera.fov/2))/innerHeight;view.panX+=(-dx*Math.cos(view.yaw)-dy*Math.sin(view.yaw)/Math.sin(view.pitch))*scale;view.panZ+=(dx*Math.sin(view.yaw)-dy*Math.cos(view.yaw)/Math.sin(view.pitch))*scale;fit(false);}
function profile(x,z){const c=context(),pin=c.pin,points=[],base=getTerrainHeight(x,z);let low=Infinity,high=-Infinity;for(let i=0;i<=40;i++){const t=i/40,h=getTerrainHeight(T.MathUtils.lerp(x,pin.x,t),T.MathUtils.lerp(z,pin.z,t));points.push(h);low=Math.min(low,h);high=Math.max(high,h);}
 const range=Math.max(.05,high-low),coords=points.map((h,i)=>`${(4+i/40*232).toFixed(2)},${(40-(h-low)/range*32).toFixed(2)}`).join(' ');document.getElementById('green-profile').innerHTML=`<polyline points="${coords}" fill="none" stroke="#e6cc91" stroke-width="1.5"/><circle cx="4" cy="${40-(points[0]-low)/range*32}" r="2" fill="#f6f1e4"/><circle cx="236" cy="${40-(points.at(-1)-low)/range*32}" r="2" fill="#e6cc91"/>`;
 document.getElementById('green-profile-label').textContent=`برش واقعی سطح تا حفره · ${fmt(Math.hypot(pin.x-x,pin.z-z)/.9144,1)} یارد · دامنهٔ ارتفاع ${fmt((high-low)*100)} سانتی‌متر (مقیاس عمودی خودکار)`;return{heights:points,min:low,max:high,base};
}
function selectPoint(x,z){const c=context();if(!enabled||!c?.inside(x,z))return false;const h=getTerrainHeight(x,z),[gx,gz]=slope(x,z),pin=c.pin,dx=x-ballPos.x,dz=z-ballPos.z,len=Math.hypot(dx,dz),ux=len>.01?dx/len:aimDirection.x,uz=len>.01?dz/len:aimDirection.z;
 const along=(gx*ux+gz*uz)*100,cross=(-gx*uz+gz*ux)*100,rise=(h-getTerrainHeight(pin.x,pin.z))*100;
 selected={x,z};marker.position.set(x,h+c.offset+.02,z);marker.visible=true;
 document.getElementById('green-read-local').textContent=`شیب محل بررسی · ${fmt(Math.hypot(gx,gz)*100,1)}٪`;
 document.getElementById('green-read-rise').textContent=Math.abs(rise)<1?'نقطهٔ بررسی تقریباً هم‌ارتفاع حفره است':`نقطهٔ بررسی ${fmt(Math.abs(rise))} سانتی‌متر ${rise>0?'بالاتر':'پایین‌تر'} از حفره`;
 document.getElementById('green-landing').textContent=`در جهت ورود از توپ: ${Math.abs(along)<.15?'تقریباً تخت':`${fmt(Math.abs(along),1)}٪ ${along>0?'سربالایی':'سرازیری'}`} · شیب جانبی: ${Math.abs(cross)<.15?'تقریباً تخت':`${fmt(Math.abs(cross),1)}٪، سرازیری به ${cross>0?'چپ':'راست'}`}`;
 document.getElementById('green-read-key').textContent=`فاصلهٔ خطوط تراز ${fmt(interval*100)} سانتی‌متر`;
 diagnostics.selection={x,z,height:h,abovePinCm:rise,alongGrade:along,crossGrade:cross,gradient:[gx,gz],profile:profile(x,z)};originGeometry();fit(false);return true;
}
function open(){if(enabled){close();return true;}if(!allowed())return false;if(cacheKey!==key()&&!build())return false;returnFocus=document.activeElement;snapshot=capture();clearGameplayGesture();enabled=true;group.visible=true;legend.hidden=false;toolbar.hidden=false;document.body.dataset.greenRead='true';button.setAttribute('aria-pressed','true');courseButton.setAttribute('aria-pressed','true');for(const[o]of snapshot.visible)if(o!==golferGroup)o.visible=false;golferGroup.visible=!!proGolferLoaded;origins.visible=true;originTag.hidden=false;selected=null;marker.visible=false;diagnostics.mode='green-read';
 document.getElementById('green-read-local').textContent='روی گرین بزنید تا محل فرود را بررسی کنید.';document.getElementById('green-read-rise').textContent='بررسی سطح، بدون تغییر کلاب، قدرت یا نشانه‌گیری';document.getElementById('green-read-key').textContent=`فاصلهٔ خطوط تراز ${fmt(interval*100)} سانتی‌متر`;document.getElementById('green-landing').textContent='';document.getElementById('green-profile').innerHTML='';document.getElementById('green-profile-label').textContent='';document.getElementById('green-read-orientation').textContent='پیکان طلایی: جهت ورود از توپ واقعی. شیب چپ/راست نسبت به همین جهت محاسبه می‌شود، نه جهت صفحه.';originGeometry();fit(true);back.focus({preventScroll:true});return true;
}
function sync(){const next=key();if(next!==stateKey)close(false);stateKey=next;}
const canvas=renderer.domElement,touches=new Map();let pinch=null,gesture=null;
function zoom(z){view.zoom=T.MathUtils.clamp(z,.005,6);fit(false);}
function pick(clientX,clientY){const rect=canvas.getBoundingClientRect(),ndc=new T.Vector2((clientX-rect.left)/rect.width*2-1,1-(clientY-rect.top)/rect.height*2),ray=new T.Raycaster();ray.setFromCamera(ndc,readCamera);let y=(diagnostics.low+diagnostics.high)/2,q=new T.Vector3();for(let i=0;i<7;i++){if(!ray.ray.intersectPlane(new T.Plane(new T.Vector3(0,1,0),-y),q))return false;y=getTerrainHeight(q.x,q.z);}return selectPoint(q.x,q.z);}
canvas.addEventListener('pointerdown',e=>{if(!enabled||(e.button!==0&&e.button!==2))return;canvas.focus({preventScroll:true});touches.set(e.pointerId,{x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,moved:false,pinched:false,pan:e.button===2||e.altKey});try{canvas.setPointerCapture(e.pointerId);}catch(_){}if(touches.size===2){const[a,b]=[...touches.values()];a.pinched=b.pinched=true;pinch={distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y)),zoom:view.zoom,angle:Math.atan2(a.y-b.y,a.x-b.x),x:(a.x+b.x)/2,y:(a.y+b.y)/2};}e.preventDefault();});
canvas.addEventListener('pointermove',e=>{if(!enabled||!touches.has(e.pointerId))return;const t=touches.get(e.pointerId),dx=e.clientX-t.x,dy=e.clientY-t.y;t.x=e.clientX;t.y=e.clientY;if(Math.hypot(t.x-t.startX,t.y-t.startY)>8)t.moved=true;if(pinch&&touches.size>=2){const[a,b]=[...touches.values()],angle=Math.atan2(a.y-b.y,a.x-b.x),x=(a.x+b.x)/2,y=(a.y+b.y)/2;rotate(-(angle-pinch.angle),0);pan(x-pinch.x,y-pinch.y);zoom(pinch.zoom*Math.hypot(a.x-b.x,a.y-b.y)/pinch.distance);Object.assign(pinch,{angle,x,y});}else if(t.moved){if(t.pan)pan(dx,dy);else rotate(-dx*.007,dy*.005);}e.preventDefault();});
function end(e){const t=touches.get(e.pointerId);if(enabled&&t&&!t.moved&&!t.pinched&&e.type==='pointerup')pick(e.clientX,e.clientY);touches.delete(e.pointerId);if(touches.size<2)pinch=null;try{if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);}catch(_){} }
for(const n of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(n,end);
canvas.addEventListener('wheel',e=>{if(!enabled||gesture)return;const unit=e.deltaMode===1?16:e.deltaMode===2?innerHeight:1;zoom(view.zoom*Math.exp(-T.MathUtils.clamp(e.deltaY*unit,-240,240)*.0035));e.preventDefault();},{passive:false});
canvas.addEventListener('gesturestart',e=>{if(enabled){gesture={zoom:view.zoom};e.preventDefault();}},{passive:false});canvas.addEventListener('gesturechange',e=>{if(enabled&&gesture&&Number.isFinite(e.scale)){zoom(gesture.zoom*e.scale);e.preventDefault();}},{passive:false});canvas.addEventListener('gestureend',e=>{if(gesture){gesture=null;e.preventDefault();}},{passive:false});
document.addEventListener('keydown',e=>{if(!enabled)return;if(e.key==='Escape'){close();e.preventDefault();return;}if(e.target!==canvas||e.ctrlKey||e.metaKey||e.altKey)return;let handled=true;if(e.key==='+'||e.key==='=')zoom(view.zoom*1.1);else if(e.key==='-')zoom(view.zoom/1.1);else if(e.key.toLowerCase()==='q')rotate(-.12);else if(e.key.toLowerCase()==='e')rotate(.12);else if(e.key.toLowerCase()==='w')rotate(0,.08);else if(e.key.toLowerCase()==='s')rotate(0,-.08);else if(e.key.toLowerCase()==='r')fit(true);else if(e.key.startsWith('Arrow')){const c=context(),p=selected||{x:c.pin.x,z:c.pin.z},step=Math.max(.15,Math.min(c.b[2]-c.b[0],c.b[3]-c.b[1])/30);selectPoint(p.x+(e.key==='ArrowRight'?step:e.key==='ArrowLeft'?-step:0),p.z+(e.key==='ArrowDown'?step:e.key==='ArrowUp'?-step:0));}else handled=false;if(handled)e.preventDefault();});
button.addEventListener('click',open);courseButton.addEventListener('click',open);back.addEventListener('click',()=>close());document.getElementById('btn-read-fit').addEventListener('click',()=>fit(true));document.getElementById('btn-read-whole').addEventListener('click',()=>mode('course'));document.getElementById('btn-read-player').addEventListener('click',()=>mode('player'));canvas.addEventListener('contextmenu',e=>{if(enabled)e.preventDefault();});
window.GreenReader={open,close,sync,tick,rotate,zoom,mode,resize:()=>fit(false),selectPoint,diagnostics,get enabled(){return enabled;},get camera(){return readCamera;},group};sync();
})();
