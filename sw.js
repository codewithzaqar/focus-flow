/* ============================================
   FocusFlow Service Worker v0.0.4
   Stale-While-Revalidate Strategy
   Serve from cache fast, update in background
   ============================================ */

const CACHE_NAME = 'focusflow-v0.0.4';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json'
];

/* ============================================
   INSTALL EVENT
   Cache core assets on first install
   ============================================ */
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                // Do NOT skipWaiting automatically - wait for user action
            })
    );
});

/* ============================================
   ACTIVATE EVENT
   Clean up old caches
   ============================================ */
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

/* ============================================
   FETCH EVENT
   Stale-While-Revalidate Strategy
   Serve from cache immediately, update cache in background
   ============================================ */
self.addEventListener('fetch', (event) => {
    const requestUrl = new URL(event.request.url);
    
    // Only handle same-origin requests
    if (requestUrl.origin !== location.origin) {
        return;
    }
    
    // Skip non-GET requests
    if (event.request.method !== 'GET') {
        return;
    }
    
    event.respondWith(
        caches.match(event.request)
            .then((cachedResponse) => {
                // Return cached response immediately (stale)
                const fetchPromise = fetch(event.request)
                    .then((networkResponse) => {
                        // Update cache in background (revalidate)
                        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                        }
                        return networkResponse;
                    })
                    .catch(() => {
                        // Network failed, but we already returned cached version
                        // This is fine - user gets stale content
                    });
                
                // Return cached response immediately, or fetch if not cached
                return cachedResponse || fetchPromise;
            })
    );
});

/* ============================================
   MESSAGE EVENT
   Handle skipWaiting message from client
   ============================================ */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        self.skipWaiting();
    }
});
