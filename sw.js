// sw.js - RezaOT v30 (faster install)
const CACHE_NAME = "rezaot-v30";

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
  console.log("Installing RezaOT Service Worker v30...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        urlsToCache.map((url) =>
          cache.add(url).catch((err) => console.warn("SW skip cache", url, err))
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

  const isDocument =
    request.destination === "document" ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith("/");
  const isScriptOrStyle =
    request.destination === "script" ||
    request.destination === "style" ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".css");

  if (isDocument || isScriptOrStyle) {
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
  } else {
    event.respondWith(
      caches.match(request).then((cached) => {
        return (
          cached ||
          fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              const clone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
            }
            return networkResponse;
          })
        );
      })
    );
  }
});
