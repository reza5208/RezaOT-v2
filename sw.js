// sw.js - RezaOT v16
const CACHE_NAME = "rezaot-v16";

const urlsToCache = [
  "./",
  "./index.html",
  "./styles.css",
  "./main.js",
  "./utils.js",
  "./constants.js",
  "./manifest.json",
  "./assets/icons/rezaot-icon.svg"
];

self.addEventListener("install", (event) => {
  console.log("Installing RezaOT Service Worker v16...");
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
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
    }).then(() => self.clients.claim())
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
