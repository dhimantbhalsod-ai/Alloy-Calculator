const CACHE_NAME = 'alloy-calc-v1';
const ASSETS = [
    './',
    './index.html',
    './styles.css',
    './app.js',
    './manifest.json',
    './icons/icon-192.png',
    './icons/icon-512.png'
];

// Install — cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

// Activate — clean up old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys
                .filter(key => key !== CACHE_NAME)
                .map(key => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

// Fetch — cache first, then network
self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request).then(cached => {
            return cached || fetch(event.request).then(response => {
                // Cache successful network responses for offline use
                if (response.ok) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Fallback for navigation requests
                if (event.request.mode === 'navigate') {
                    return caches.match('./index.html');
                }
            });
        })
    );
});
