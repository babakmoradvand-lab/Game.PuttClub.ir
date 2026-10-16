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
  let checking = false, running = false, lastCheckpoint = null;
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
      let timer;const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>{channel.port1.close();reject(Error('Offline operation timed out'));},180000);};arm();
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
    let reg=await navigator.serviceWorker.getRegistration('./');
    if(!reg)reg=await navigator.serviceWorker.register('./sw.js',{updateViaCache:'none'});
    else if(navigator.onLine) {
      try {await reg.update();}catch(error) {console.info('Worker check unavailable:',error.message);}
    }
    const pending=reg.installing||reg.waiting;
    if(pending&&pending.state!=='activated'&&pending.state!=='redundant') {
      await Promise.race([new Promise(resolve=>pending.addEventListener('statechange',()=>{
        if(['activated','redundant'].includes(pending.state))resolve();
      })),new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker activation timed out')),20000))]);
    }
    if(!navigator.serviceWorker.controller)await Promise.race([
      new Promise(resolve=>navigator.serviceWorker.addEventListener('controllerchange',resolve,{once:true})),
      new Promise((_,reject)=>setTimeout(()=>reject(Error('Worker control timed out')),20000))
    ]);
    return reg;
  }
  async function descriptor() {
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),10000);
    try {
      const response=await fetch('./release.json',{cache:'no-store',signal:abort.signal});
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
    }
    if(!window.PuttUI)throw Error('Game interface did not initialize');
  }
  function checkpoint() {
    try {const value=window.PuttUI?.exportSession();if(value){lastCheckpoint=value;if(value.started)localStorage.setItem('puttclub-round-v1',JSON.stringify(value));}}catch(error) {console.info(error.message);}
  }
  async function check() {
    if(checking)return;checking=true;
    show('بررسی نسخه و ذخیرهٔ بازی…');bar.removeAttribute('value');detail.textContent='بازی پس از بررسی نسخهٔ کامل باز می‌شود.';
    try {
      await controller();
      const result=await runtime();
      window.PuttBoot={ready:true,version:result.state.manifest.version,count:result.state.manifest.assets.length,bytes:result.state.manifest.assets.reduce((s,a)=>s+a.bytes,0),status:result.status,reason:result.reason||null,rpc,check};
      if(result.state.manifest.version!==pageVersion) {
        // New HTML and scripts must belong to the same committed release.
        // Foreground updates preserve an idle checkpoint; unfinished shots are
        // explicitly rolled back to their pre-strike position, never fabricated.
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
      label.textContent='ذخیرهٔ کامل بازی انجام نشد.';
      detail.textContent='اینترنت و فضای خالی گوشی را بررسی کنید و دوباره تلاش کنید. '+error.message;
      retry.hidden=false;bar.value=0;
      console.warn('Game boot:',error.message);
    } finally {checking=false;}
  }
  setInterval(()=>{if(running&&!window.PuttBootPaused)checkpoint();},1500);
  retry.addEventListener('click',check);
  document.addEventListener('click',event=>{
    if(event.target.closest('#btn-launch-shot,#btn-putt-action'))checkpoint();
  },true);
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden) {checkpoint();window.PuttBootPaused=true;}
    else if(running)check();
  });
  addEventListener('pageshow',event=>{if(event.persisted&&running)check();});
  document.readyState==='loading'?document.addEventListener('DOMContentLoaded',check,{once:true}):check();
})();
