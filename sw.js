const CACHE_PREFIX = 'putt-club-game-';
const CACHE_NAME = CACHE_PREFIX + 'v2026-10-13-start-fix-7';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './sw.js',
  './ui.css?v=start7',
  './ui.js?v=start7',
  './game.js?v=start7',
  './pro_golfer_cutout.png',
  './satellite_ortho.jpg',
  './fonts/Inter-2.ttf',
  './fonts/Vazirmatn-2.ttf',
  './fonts/Inter-0.ttf',
  './fonts/Vazirmatn.css',
  './fonts/Vazirmatn-3.ttf',
  './fonts/Vazirmatn-1.ttf',
  './fonts/Vazirmatn-0.ttf',
  './fonts/Inter.css',
  './fonts/Inter-3.ttf',
  './fonts/Inter-1.ttf',
  './icon-192.png',
  './icon-512.png',
  './putt_club_hero.webp',
  './three.min.js',
  './GLTFLoader.js',
  './OrbitControls.js',
  './pro_golfer_character.glb',
  './golfer_360_texture.png',
  './embedded_data.js',
  './tree_textures.js',
  './terrain_data.json',
  './map_meta.json',
  './golf_features.json',
  './course_logic_18holes.json',
  './buildings_osm.json',
  './tehran_satellite.jpg',
  './tehran_terrain.json',
  './tehran_golf_features.json',
  './tehran_course_18.json',
  './pro_textures.json',
  './mis_authentic_textures.json',
  './mis_real_roads.json',
  './tracer_textures.json',
  './real_bark.jpg',
  './real_foliage.png',
  './bark_tex.jpg',
  './foliage_leaf.png'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // A failed optional asset must not discard the whole installation.
    await Promise.all(ASSETS_TO_CACHE.map(async path => {
      try {
        const response = await fetch(new Request(path, {cache: 'reload'}));
        if (!response.ok) throw new Error('HTTP ' + response.status);
        await cache.put(path, response);
      } catch (error) {
        console.warn('[PWA] Cannot precache', path, error);
      }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key =>
      key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME
    ).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  // Avoid touching other projects sharing this GitHub Pages origin.
  if (url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(event.request);
    if (cached) return cached;
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        await cache.put(event.request, response.clone());
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const fallback = await cache.match('./index.html');
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
