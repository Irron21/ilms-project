/* eslint-disable no-restricted-globals */
const CACHE_NAME = 'k2mac-prod-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo192.png',
  '/logo512.png'
];

// 1. INSTALL: Cache the "Shell" immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('SW: Caching App Shell');
      return cache.addAll(STATIC_ASSETS);
    })
  );
});

// 2. FETCH: The "Brain" (Cache Logic)
// 2. FETCH: The "Brain" (Cache Logic)
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // 🛡️ SECURITY FIX: Ignore Chrome Extensions, API calls, and non-GET requests
  if (
    url.startsWith('chrome-extension') || 
    url.includes('/api/') || 
    event.request.method !== 'GET'
  ) {
    return; // Let the browser handle these normally
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // A. If file is in cache, return it immediately
      if (cachedResponse) {
        return cachedResponse;
      }

      // B. If not, fetch from internet
      return fetch(event.request)
        .then((networkResponse) => {
          // Check if valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            return networkResponse;
          }

          // C. Save copy to cache (Safe now!)
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return networkResponse;
        })
        .catch(() => {
          // D. Fallback for navigation (Deep linking fix)
          if (event.request.mode === 'navigate') {
            return caches.match('/index.html');
          }
        });
    })
  );
});

// 3. ACTIVATE: Cleanup old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  event.waitUntil(self.clients.claim());
});