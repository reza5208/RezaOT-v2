// sw.js - RezaOT v39
const CACHE_NAME = "rezaot-v39";
const urlsToCache = [
  "./", "./index.html",
  "./styles.css", "./styles-v18-extra.css", "./styles-salary.css", "./styles-v27.css", "./styles-header-fix.css", "./styles-ux-v38.css", "./styles-print-v39.css",
  "./main.js", "./main-app-1.js", "./main-app-2.js", "./app-p1.js",
  "./i18n.js", "./salary-estimator.js", "./utils.js", "./constants.js", "./holiday-picker.js",
  "./manifest.json",
  "./assets/icons/favicon-32x32.png", "./assets/icons/android-icon-192x192.png"
];
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(urlsToCache.map((u) => cache.add(u).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.map((n) => (n !== CACHE_NAME ? caches.delete(n) : null)))
    ).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  const isHTML = request.destination === "document" || url.pathname.endsWith(".html") || url.pathname.endsWith("/");
  if (isHTML) {
    event.respondWith(
      fetch(request).then((r) => {
        if (r && r.status === 200) {
          const c = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
        }
        return r;
      }).catch(() => caches.match(request).then((c) => c || caches.match("./index.html")))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      const net = fetch(request).then((r) => {
        if (r && r.status === 200) {
          const c = r.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, c));
        }
        return r;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
