/* PuttClub atomic offline runtime. Only this game's scope is managed. */
const WORKER_RELEASE = 'golfer49-20261018';
const SCOPE = self.registration.scope;
const CACHE_PREFIX = 'puttclub-runtime:' + new URL(SCOPE).pathname + ':';
const META_CACHE = 'puttclub-meta:' + new URL(SCOPE).pathname;
const STATE_URL = new URL('./__runtime_state__', SCOPE).href;
let queue = Promise.resolve();
const absolute = p => new URL(p, SCOPE).href;
async function state() {
  const r = await (await caches.open(META_CACHE)).match(STATE_URL);
  return r ? r.json() : null;
}
async function saveState(value) {
  await (await caches.open(META_CACHE)).put(STATE_URL, new Response(JSON.stringify(value), {headers:{'Content-Type':'application/json'}}));
}
async function digest(response) {
  const bytes = await response.clone().arrayBuffer();
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2,'0')).join('');
}
async function validateCached(current) {
  if (!current?.complete) return null;
  const cache = await caches.open(current.cache);
  for (const asset of current.manifest.assets) {
    if (!(await cache.match(absolute(asset.url)))) return null;
  }
  return current;
}
async function installRuntime(manifest, send) {
  if (!manifest?.version || !Array.isArray(manifest.assets) || !manifest.assets.length) throw Error('Invalid release manifest');
  for (const asset of manifest.assets) {
    const url = new URL(asset.url, SCOPE);
    if (url.origin !== new URL(SCOPE).origin || !url.href.startsWith(SCOPE) || !/^[a-f0-9]{64}$/.test(asset.sha256)) throw Error('Invalid runtime asset');
  }
  const current = await validateCached(await state());
  if (current?.manifest.version === manifest.version || (current?.manifest.createdAt > manifest.createdAt)) return current;
  const name = CACHE_PREFIX + manifest.version;
  await caches.delete(name);
  const target = await caches.open(name);
  let old = current ? await caches.open(current.cache) : null;
  // Migrate an existing game cache, verifying content before reusing it.
  if (!old) {
    for (const name of (await caches.keys()).filter(k => k.startsWith('putt-club-game-')).reverse()) {
      const cache=await caches.open(name);
      if(await cache.match(absolute('./index.html'),{ignoreSearch:true})) {old=cache;break;}
    }
  }
  let done = 0, bytes = 0, reused = 0, downloaded = 0, reusedBytes = 0, downloadedBytes = 0;
  const totalBytes = manifest.assets.reduce((n,a) => n+a.bytes,0);
  const work = [...manifest.assets];
  const progress = () => send({type:'PROGRESS',done,total:manifest.assets.length,bytes,totalBytes,reused,downloaded,reusedBytes,downloadedBytes});
  progress();
  try {
    const workers = Array.from({length:3},async () => {
      while(work.length) {
        const asset = work.shift(), key = absolute(asset.url);
        let response = old ? await old.match(key,{ignoreSearch:true}) : null;
        if (response && (await digest(response)) === asset.sha256) {reused++;reusedBytes+=asset.bytes;}
        else {
          const url = new URL(key);url.searchParams.set('__release',manifest.version);
          const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),90000);
          try {
            response = await fetch(url.href,{cache:'no-store',signal:abort.signal});
            if (!response.ok || (await digest(response)) !== asset.sha256) throw Error('Asset failed validation: '+asset.url);
          } finally {clearTimeout(timer);}
          downloaded++;downloadedBytes+=asset.bytes;
        }
        await target.put(key,response.clone());
        done++;bytes+=asset.bytes;progress();
      }
    });
    // Wait for every worker before deciding whether the staging cache is usable.
    const outcomes = await Promise.allSettled(workers);
    const failed = outcomes.find(r => r.status==='rejected');
    if (failed) throw failed.reason;
    if (done!==manifest.assets.length) throw Error('Incomplete download');
    const index = await target.match(absolute('./index.html'));
    await target.put(absolute('./'),index.clone());
    const next = {complete:true,cache:name,manifest,previous:current?.cache || null,installedAt:Date.now(),reused,downloaded,reusedBytes,downloadedBytes};
    // Commit only after ALL assets passed integrity checks. Keep the old build
    // until the new interface successfully starts and confirms HEALTHY.
    await saveState(next);
    return next;
  } catch(error) {
    await caches.delete(name);
    throw error;
  }
}
self.addEventListener('install',event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event => event.waitUntil(self.clients.claim()));
self.addEventListener('message',event => {
  const port=event.ports[0];if(!port)return;
  const send = value => port.postMessage(value);
  const task = async () => {
    try {
      if(event.data.type==='STATUS')send({type:'DONE',state:await validateCached(await state())});
      else if(event.data.type==='INSTALL_RUNTIME') {
        const next=await installRuntime(event.data.manifest,send);send({type:'DONE',state:next});
      } else if(event.data.type==='HEALTHY') {
        const current=await state();
        if(current?.manifest.version===event.data.version) {
          const keys=await caches.keys();
          await Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==current.cache).map(k=>caches.delete(k)));
          // This prefix belongs to the earlier versions of this game only.
          for(const key of keys.filter(k=>k.startsWith('putt-club-game-'))) {
            if(await (await caches.open(key)).match(absolute('./index.html'),{ignoreSearch:true}))await caches.delete(key);
          }
          current.previous=null;await saveState(current);
        }
        send({type:'DONE',state:current});
      }
    } catch(error) {send({type:'ERROR',message:error.message,state:await validateCached(await state())});}
  };
  const job=queue.then(task);queue=job.catch(()=>{});event.waitUntil(job);
});
self.addEventListener('fetch',event => {
  if(event.request.method!=='GET')return;
  const url=new URL(event.request.url);
  if(url.origin!==new URL(SCOPE).origin||!url.href.startsWith(SCOPE))return;
  if(url.pathname.endsWith('/release.json')) {
    const fresh=new URL(event.request.url);fresh.searchParams.set('__check',Date.now());
    event.respondWith(fetch(fresh.href,{cache:'no-store'}));return;
  }
  event.respondWith((async () => {
    const current=await state();
    if(current?.complete) {
      const cache=await caches.open(current.cache);
      if(event.request.mode==='navigate')return (await cache.match(absolute('./index.html')))||Response.error();
      const cached=await cache.match(event.request,{ignoreSearch:true});
      if(cached)return cached;
    }
    // No committed runtime yet: obtain the new boot page, not a stale legacy
    // index. Legacy data is available as a last resort while offline.
    try {return await fetch(event.request);}catch(error) {
      const keys=(await caches.keys()).filter(k=>k.startsWith('putt-club-game-')).reverse();
      for(const name of keys) {
        const cache=await caches.open(name);
        const r=await cache.match(event.request,{ignoreSearch:true}) || (event.request.mode==='navigate'?await cache.match(absolute('./index.html')):null);
        if(r)return r;
      }
      return Response.error();
    }
  })());
});
