/* Boot is intentionally independent of Three.js and the game controller. */
(() => {
  'use strict';
  const pageVersion = document.querySelector('meta[name="putt-release"]').content;
  const overlay = document.getElementById('runtime-boot');
  const label = document.getElementById('boot-message');
  const detail = document.getElementById('boot-detail');
  const bar = document.getElementById('boot-progress');
  const retry = document.getElementById('boot-retry');
  const underlying = ['putt-club-splash','setup-shell','game-ui'];
  let checking = false, running = false, lastCheckpoint = null, activeCheck = null, updateDeferred = false;
  function show(message) {
    overlay.hidden=false;label.textContent=message;retry.hidden=true;
    underlying.forEach(id=>document.getElementById(id).inert=true);
    window.PuttBootPaused=true;
  }
  function hide() {
    overlay.hidden=true;window.PuttBootPaused=false;
    underlying.forEach(id=>document.getElementById(id).inert=id==='game-ui' && (document.getElementById('celebration-overlay').style.display!=='none'||!document.getElementById('course-relief')?.hidden&&!!document.getElementById('course-relief')));
  }
  function rpc(type, data={}, progress) {
    return new Promise((resolve,reject)=>{
      const worker=navigator.serviceWorker.controller;
      if(!worker)return reject(Error('No offline worker'));
      const channel=new MessageChannel();
      let timer;const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{channel.port1.close();reject(Error('Offline operation timed out'));},type==='INSTALL_RUNTIME'?180000:15000);};arm();
      channel.port1.onmessage=event=>{
        const value=event.data;
        if(value.type==='PROGRESS') {arm();if(progress)progress(value);return;}
        clearTimeout(timer);channel.port1.close();
        if(value.type==='ERROR') {const error=Error(value.message);error.state=value.state;reject(error);}else resolve(value.state);
      };
      worker.postMessage({type,...data},[channel.port2]);
    });
  }
  async function controller() {
    if(!('serviceWorker' in navigator)||!isSecureContext)throw Error('Offline installation requires HTTPS and Service Workers');
    const scope=new URL('./',location.href).href;
    let reg=await navigator.serviceWorker.getRegistration(scope);
    if(!reg||reg.scope!==scope||navigator.onLine) {
      try {reg=await navigator.serviceWorker.register('./sw.js?v=rollback33-20261017',{scope:'./',updateViaCache:'none'});}
      catch(error){if(!reg||reg.scope!==scope)throw error;console.info('Worker check unavailable:',error.message);}
    }
    const pending=reg.installing||reg.waiting;
    if(pending&&pending.state!=='activated'&&pending.state!=='redundant') {
      await Promise.race([new Promise(resolve=>pending.addEventListener('statechange',()=>{
        if(['activated','redundant'].includes(pending.state))resolve();
      })),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker activation timed out')),20000))]);
    }
    const controlled=()=>navigator.serviceWorker.controller && (!reg.active||navigator.serviceWorker.controller.scriptURL===reg.active.scriptURL);
    if(!controlled())await new Promise((resolve,reject)=>{
      const done=()=>{if(controlled()){clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',done);resolve();}};
      const timer=setTimeout(()=>{navigator.serviceWorker.removeEventListener('controllerchange',done);reject(Error('Worker control timed out'));},20000);
      navigator.serviceWorker.addEventListener('controllerchange',done);done();
    });
    return reg;
  }
  async function descriptor() {
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
    try {
      const url=new URL('./release.json',location.href);url.searchParams.set('__check',Date.now());
      const response=await fetch(url.href,{cache:'no-store',signal:abort.signal});
      if(!response.ok)throw Error('Release check HTTP '+response.status);
      return await response.json();
    } finally {clearTimeout(timer);}
  }
  function progress(value) {
    bar.max=value.totalBytes;bar.value=value.bytes;
    label.textContent='ذخیره و بررسی فایل‌های بازی…';
    detail.textContent=`${value.done} / ${value.total} فایل · ${(value.bytes/1048576).toFixed(1)} / ${(value.totalBytes/1048576).toFixed(1)} MB`;
  }
  async function runtime() {
    let cached=null;
    try {cached=await rpc('STATUS');}catch(error) {console.info('Existing cache status:',error.message);}
    if(!navigator.onLine) {
      if(!cached)throw Error('First installation requires an internet connection');
      return {state:cached,status:'offline'};
    }
    try {
      const manifest=await descriptor();
      const state=await rpc('INSTALL_RUNTIME',{manifest},progress);
      return {state,status:state.manifest.version===cached?.manifest.version?'current':'installed'};
    } catch(error) {
      // STATUS checks completeness again: a previous good build is the ONLY
      // permitted fallback, not an arbitrary partially downloaded cache.
      cached=error.state||await rpc('STATUS');
      if(cached)return {state:cached,status:'update-unavailable',reason:error.message};
      throw error;
    }
  }
  async function loadScripts() {
    for(const source of document.querySelectorAll('script[data-runtime-src]')) {
      await new Promise((resolve,reject)=>{
        const script=document.createElement('script');script.src=source.dataset.runtimeSrc;
        script.onload=resolve;script.onerror=()=>reject(Error('Runtime script failed: '+script.src));
        document.body.appendChild(script);
      });
      if(source.dataset.runtimeSrc.includes('course-runtime.js'))await window.PuttCourseReady;
      if(source.dataset.runtimeSrc.includes('caddie-system.js'))await window.CaddieReady;
    }
    if(!window.PuttUI)throw Error('Game interface did not initialize');
  }
  function checkpoint() {
    try {const value=window.PuttUI?.exportSession();if(value){lastCheckpoint=value;if(value.started)localStorage.setItem('puttclub-round-v1',JSON.stringify(value));return true;}}catch(error) {console.info(error.message);}
    return false;
  }
  function check() {
    if(activeCheck)return activeCheck;
    activeCheck=performCheck().finally(()=>{activeCheck=null;});return activeCheck;
  }
  async function performCheck() {
    if(checking)return;
    if(running&&!checkpoint()){updateDeferred=true;return {deferred:true};}
    updateDeferred=false;checking=true;
    show('بررسی نسخه و ذخیرهٔ بازی…');bar.removeAttribute('value');detail.textContent='بازی پس از بررسی نسخهٔ کامل باز می‌شود.';
    try {
      await controller();
      const result=await runtime();
      window.PuttBoot={ready:true,version:result.state.manifest.version,count:result.state.manifest.assets.length,bytes:result.state.manifest.assets.reduce((s,a)=>s+a.bytes,0),status:result.status,reason:result.reason||null,checkedAt:Date.now(),rpc,check};
      if(result.state.manifest.version!==pageVersion) {
        // New HTML and scripts must belong to the same committed release.
        // Foreground updates wait for an idle checkpoint; no airborne shot is
        // interrupted, rewound or counted twice by the updater.
        if(running) {
          checkpoint();
          if(lastCheckpoint)sessionStorage.setItem('puttclub-update-session',JSON.stringify(lastCheckpoint));
        }
        location.reload();return;
      }
      if(!running) {
        await loadScripts();running=true;
        const saved=sessionStorage.getItem('puttclub-update-session')||localStorage.getItem('puttclub-round-v1');
        if(saved) {
          try {await window.PuttUI.importSession(JSON.parse(saved));sessionStorage.removeItem('puttclub-update-session');}
          catch(error) {console.warn('Round checkpoint unavailable:',error.message);}
        }
        // Best effort only. Safari is still permitted to evict local storage.
        if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
        await rpc('HEALTHY',{version:pageVersion});
      }
      window.PuttUI?.refreshOffline();hide();checkpoint();
    } catch(error) {
      const storageProblem=/quota|storage.*(denied|full|unavailable)/i.test(error.message);
      label.textContent=storageProblem?'فضای ذخیره‌سازی در دسترس نیست.':'ذخیرهٔ کامل بازی انجام نشد.';
      detail.textContent=storageProblem?'از پنجرهٔ معمولی مرورگر، نه حالت خصوصی، استفاده کنید و فضای خالی دستگاه را بررسی کنید. هیچ دور ذخیره‌شده‌ای حذف نشد.':'اینترنت و فضای خالی دستگاه را بررسی کنید و دوباره تلاش کنید. '+error.message;
      retry.hidden=false;bar.value=0;
      console.warn('Game boot:',error.message);
    } finally {checking=false;}
  }
  setInterval(()=>{if(running&&!window.PuttBootPaused){const safe=checkpoint();if(updateDeferred&&safe&&!document.hidden)check();}},1500);
  retry.addEventListener('click',check);
  addEventListener('online',()=>{if(running&&!document.hidden)check();});
  document.addEventListener('click',event=>{
    if(event.target.closest('#btn-launch-shot,#btn-putt-action'))checkpoint();
  },true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {checkpoint();window.PuttBootPaused=true;}
    else {window.PuttBootPaused=false;if(running)check();}
  });
  addEventListener('pageshow',event=>{if(event.persisted&&running&&!document.hidden){window.PuttBootPaused=false;check();}});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',check,{once:true}):check();
})();
