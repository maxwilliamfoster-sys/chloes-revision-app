/* Chloe's Revision — service worker: keeps the whole app working with no internet.
   (The AI model itself is stored by WebLLM in its own cache after the one-time download.) */
const VERSION = '__VERSION__';
const CORE = __CORE__;
const HEAVY = __HEAVY__;
const CACHE = 'chloe-' + VERSION;

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    await c.addAll(CORE.map((u) => new Request(u, { cache: 'reload' })));
    // big assistant files: best effort, one at a time (a failure here must not block the app)
    for (const u of HEAVY) { try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); } catch (err) { /* will retry on next visit */ } }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keep = CACHE;
    for (const k of await caches.keys()) if (k.startsWith('chloe-') && k !== keep) {
      // copy any heavy files the new cache is missing (e.g. installed while offline), then delete the old one
      const old = await caches.open(k), cur = await caches.open(keep);
      for (const u of HEAVY) { const hit = await cur.match(u); if (!hit) { const o = await old.match(u); if (o) await cur.put(u, o); } }
      await caches.delete(k);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return; // model downloads are handled by WebLLM itself
  if (req.mode === 'navigate') {
    // try the network for a fresh version (3 s max), otherwise use the saved copy
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      try {
        const net = await Promise.race([fetch(req), new Promise((_, no) => setTimeout(() => no(new Error('slow')), 3000))]);
        if (net && net.ok) { c.put('index.html', net.clone()); return net; }
        throw new Error('bad');
      } catch (err) { return (await c.match('index.html')) || (await caches.match(req)) || Response.error(); }
    })());
    return;
  }
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    const net = await fetch(req);
    if (net.ok) { const c = await caches.open(CACHE); c.put(req, net.clone()); }
    return net;
  })());
});
