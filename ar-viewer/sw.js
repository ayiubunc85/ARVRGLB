var CACHE_NAME = 'ar-viewer-v1';
var PRECACHE_URLS = [
  '/ar/',
  'https://ajax.googleapis.com/ajax/libs/model-viewer/3.4.0/model-viewer.min.js',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_URLS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (names) {
      return Promise.all(
        names.filter(function (n) { return n !== CACHE_NAME; })
          .map(function (n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (e) {
  var url = new URL(e.request.url);

  // Cache model files after first fetch (so revisiting the same model works offline)
  if (url.pathname.startsWith('/models/')) {
    e.respondWith(
      caches.open(CACHE_NAME).then(function (cache) {
        return cache.match(e.request).then(function (cached) {
          if (cached) return cached;
          return fetch(e.request).then(function (response) {
            if (response.ok) cache.put(e.request, response.clone());
            return response;
          });
        });
      })
    );
    return;
  }

  // For viewer page + model-viewer lib: cache-first
  e.respondWith(
    caches.match(e.request).then(function (cached) {
      return cached || fetch(e.request);
    })
  );
});
