// service-worker.js - Basic PWA Service Worker for caching assets

const CACHE_NAME = 'dashboard-cache-v1';
const urlsToCache = [
    '/',
    '/static/style.css', // Assuming you have a main stylesheet
    '/static/dashboard.js',
    '/node_modules/chart.js/dist/chart.umd.js',
    '/node_modules/@fullcalendar/core/index.global.min.js',
    '/node_modules/@fullcalendar/daygrid/index.global.min.js',
    '/node_modules/@fullcalendar/interaction/index.global.min.js',
    '/node_modules/flatpickr/dist/flatpickr.min.js',
    '/node_modules/flatpickr/dist/flatpickr.min.css',
    '/static/icons/icon-192x192.png', // Add your icon paths
    '/static/icons/icon-512x512.png',
    // Add other essential assets you want to cache for offline use
    // e.g., images, other JS/CSS files
];

self.addEventListener('install', (event) => {
    console.log('Service Worker: Installing...');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('Service Worker: Caching app shell');
                return cache.addAll(urlsToCache);
            })
            .catch((error) => {
                console.error('Service Worker: Cache addAll failed', error);
            })
    );
});

self.addEventListener('fetch', (event) => {
    // Only handle GET requests for caching
    if (event.request.method === 'GET') {
        event.respondWith(
            caches.match(event.request)
                .then((response) => {
                    // Cache hit - return response
                    if (response) {
                        return response;
                    }
                    // No cache hit - fetch from network
                    return fetch(event.request)
                        .then((fetchResponse) => {
                            // Check if we received a valid response
                            if (!fetchResponse || fetchResponse.status !== 200 || fetchResponse.type !== 'basic') {
                                return fetchResponse;
                            }
                            // Clone the response because it's a stream and can only be consumed once
                            const responseToCache = fetchResponse.clone();
                            caches.open(CACHE_NAME)
                                .then((cache) => {
                                    cache.put(event.request, responseToCache);
                                });
                            return fetchResponse;
                        });
                })
                .catch((error) => {
                    console.error('Service Worker: Fetch failed', error);
                    // You might want to serve an offline page here
                    // return caches.match('/offline.html'); // Example
                })
        );
    }
});

self.addEventListener('activate', (event) => {
    console.log('Service Worker: Activating...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('Service Worker: Deleting old cache', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});