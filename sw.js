// Pages and data from the network; static assets from the cache
const CACHE = 'rovaz-v1';
const ASSETS = ['css/app.css', 'js/app.js', 'js/shell.js', 'assets/logo-ashdod.png', 'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('index.html')));
    return;
  }
  const isImage = /\.(png|svg|jpg|jpeg|webp|pdf)$/i.test(url.pathname);
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = await c.match(req);
    if (isImage && hit) return hit;
    // code and styles: network first so a new deploy shows up right away
    return fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; }).catch(() => hit);
  }));
});
