const CACHE_NAME = "rezaot-v5";   // Naikkan version

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./constants.js",
  "./utils.js",
  "./main.js",
  "./manifest.json",
  "./assets/icons/android-icon-192x192.png",
  "./assets/icons/android-icon-512x512.png",
  "./assets/icons/apple-icon-180x180.png"
];

self.addEventListener("install", event => {
  console.log("✅ Installing RezaOT Service Worker v5...");
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
