// sw.js - RezaOT v8
const CACHE_NAME = "rezaot-v8";

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./utils.js",
  "./constants.js",
  "./manifest.json",
  "./assets/icons/android-icon-192x192.png",
  "./assets/icons/ms-icon-310x310.png",
  "./assets/icons/apple-icon-180x180.png",
  "./assets/icons/android-icon-144x144.png",
  "./assets/icons/android-icon-96x96.png",
  "./assets/icons/favicon-32x32.png",
  "./assets/icons/favicon-16x16.png"
];

// Install - cache core assets
self.addEventListener("install", (event) => {
  console.log("✅ Installing RezaOT Service Worker v8...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches + take control immediately
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log("🗑 Deleting old cache:", cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch strategy:
// - HTML / JS / CSS → Network first, fallback to cache (supaya update cepat)
// - Icons & static → Cache first
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET and external requests (Firebase, CDN, etc.)
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const isDocument = request.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  const isScriptOrStyle =
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isDocument || isScriptOrStyle) {
    // Network first
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
  } else {
    // Cache first (icons, images, etc.)
    event.respondWith(
      caches.match(request).then((cached) => {
        return cached || fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        });
      })
    );
  }
});
