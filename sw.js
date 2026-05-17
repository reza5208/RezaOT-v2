const CACHE_NAME = "pwe-overtime-v4";

const urlsToCache = [
    "/index.html",
    "/styles.css",
    "/constants.js",
    "/utils.js",
    "/main.js",
    "/manifest.json",
    "/assets/icons/favicon.ico",
    "/assets/icons/apple-icon-57x57.png",
    "/assets/icons/android-icon-192x192.png",
    "/assets/icons/android-icon-512x512.png"
];

self.addEventListener("install", event => {
    console.log("Installing service worker v4...");
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cache => {
                    if (cache !== CACHE_NAME) return caches.delete(cache);
                })
            );
        })
    );
});

self.addEventListener("fetch", event => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
