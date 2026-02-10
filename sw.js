/* ============================================
   FocusFlow Service Worker v0.0.4.dev1
   Cache First, Network Fallback Strategy
   With skipWaiting message handler for updates
   ============================================ */

const CACHE_NAME = 'focusflow-v0.0.4.dev2';
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
    console.log('[SW] Install event triggered');
    
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[SW] Caching core assets:', ASSETS_TO_CACHE);
                return cache.addAll(ASSETS_TO_CACHE);
            })
            .then(() => {
                console.log('[SW] All core assets cached successfully');
                // Do NOT skipWaiting automatically - wait for user action
            })
            .catch((error) => {
                console.error('[SW] Failed to cache assets:', error);
            })
    );
});

/* ============================================
   ACTIVATE EVENT
   Clean up old caches
   ============================================ */
self.addEventListener('activate', (event) => {
    console.log('[SW] Activate event triggered');
    
    event.waitUntil(
        caches.keys()
            .then((cacheNames) => {
                return Promise.all(
                    cacheNames
                        .filter((name) => name !== CACHE_NAME)
                        .map((name) => {
                            console.log('[SW] Deleting old cache:', name);
                            return caches.delete(name);
                        })
                );
            })
            .then(() => {
                console.log('[SW] Old caches cleared, claiming clients');
                // Take control of all pages immediately
                return self.clients.claim();
            })
    );
});

/* ============================================
   FETCH EVENT
   Cache First, Network Fallback Strategy
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
                if (cachedResponse) {
                    return cachedResponse;
                }
                
                return fetch(event.request)
                    .then((networkResponse) => {
                        // Don't cache non-successful responses
                        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        
                        // Clone the response since we need to use it twice
                        const responseToCache = networkResponse.clone();
                        
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        
                        return networkResponse;
                    })
                    .catch((error) => {
                        console.error('[SW] Network fetch failed:', error);
                        
                        // Return a fallback for navigation requests
                        if (event.request.mode === 'navigate') {
                            return caches.match('/index.html');
                        }
                        
                        return new Response('Offline', {
                            status: 503,
                            statusText: 'Service Unavailable'
                        });
                    });
            })
    );
});

/* ============================================
   MESSAGE EVENT
   Handle skipWaiting message from client
   ============================================ */
self.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SKIP_WAITING') {
        console.log('[SW] Received SKIP_WAITING message, activating new version');
        self.skipWaiting();
    }
});

console.log('[SW] Service Worker script loaded - v0.0.4.dev2');
