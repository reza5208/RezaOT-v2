// sw.js - RezaOT v7
const CACHE_NAME = "rezaot-v7";

const urlsToCache = [
    "./",
    "./index.html",
    "./styles.css",
    "./main.js",
    "./utils.js",
    "./constants.js",
    "./manifest.json",
    "./assets/icons/icon-192.png",
    "./assets/icons/icon-512.png",
    "./assets/icons/apple-icon-180.png"
];

self.addEventListener("install", (event) => {
    console.log("✅ Installing RezaOT Service Worker v7...");
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(urlsToCache))
    );
});

self.addEventListener("activate", (event) => {
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

self.addEventListener("fetch", (event) => {
    event.respondWith(
        caches.match(event.request).then(response => {
            return response || fetch(event.request);
        })
    );
});
