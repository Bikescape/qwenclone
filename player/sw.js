const CACHE_NAME = 'treasurehunt-v1';
const urlsToCache = [
  '/player/index.html',
  '/player/style.css',
  '/player/script.js',
  '/player/db.js',
  '/assets/icon-192.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});