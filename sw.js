// sw.js - RezaOT v31
const CACHE_NAME = "rezaot-v31";

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles-v18-extra.css",
  "./styles-salary.css",
  "./styles-v27.css",
  "./main.js",
  "./main-app-1.js",
  "./main-app-2.js",
  "./app-p1.js",
  "./sync-fix.js",
  "./i18n.js",
  "./salary-estimator.js",
  "./utils.js",
  "./constants.js",
  "./holiday-picker.js",
  "./manifest.json",
  "./assets/icons/favicon-32x32.png",
  "./assets/icons/android-icon-192x192.png"
];

self.addEventListener("install", (event) => {
  console.log("Installing RezaOT Service Worker v31...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => console.warn("SW skip", url, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) return caches.delete(cache);
        })
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  const isHTML =
    request.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || caches.match("./index.html"))
        )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});
