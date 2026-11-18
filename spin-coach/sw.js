/* Service Worker: App offline verfügbar machen. Netz zuerst, damit Updates sofort ankommen. */
const CACHE = 'spin-coach-v1';
const FILES = ['./', 'index.html', 'css/style.css', 'manifest.webmanifest', 'icon.svg',
  'js/core/cards.js', 'js/core/eval.js', 'js/data/eq2.js', 'js/data/pushfold.js', 'js/core/equity.js',
  'js/input/parser.js', 'js/core/game.js', 'js/strategy/preflop.js', 'js/strategy/postflop.js', 'js/strategy/coach.js',
  'js/store.js', 'js/input/voice.js', 'js/ui/ui.js', 'js/ui/review.js', 'js/ui/trainer.js', 'js/ui/ranges.js', 'js/ui/stats.js', 'js/ui/app.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
