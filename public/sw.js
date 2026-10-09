const CACHE_NAME = 'office-manager-v1';

const urlsToCache = [
  '/',
  '/login',
  '/manifest.json',
  '/icon-192.svg',
  '/icon-512.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Exclude non-GET requests
  if (event.request.method !== 'GET') return;
  // Exclude Chrome extensions
  if (url.protocol === 'chrome-extension:') return;

  // STRICTLY bypass caching for sensitive routes
  if (url.pathname.startsWith('/api/vault') || url.pathname.startsWith('/api/admin/bills')) {
    return; // Will fallback to default browser fetch with no caching
  }

  // Stale-while-revalidate for everything else
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request).then((networkResponse) => {
        // Only cache successful HTTP responses
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // Fallback for offline if network fails and no cache exists
        return cachedResponse;
      });

      return cachedResponse || fetchPromise;
    })
  );
});
