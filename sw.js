// sw.js - RezaOT Service Worker v6
const CACHE_NAME = "rezaot-v6";   // Naikkan version bila update

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./utils.js",
  "./constants.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-icon-180.png"
];

self.addEventListener("install", (event) => {
  console.log("✅ RezaOT Service Worker installing... v6");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
