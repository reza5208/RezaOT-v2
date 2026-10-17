// sw.js - RezaOT v69
const CACHE_NAME = "rezaot-v69";
const urlsToCache = [
  "./", "./index.html",
  "./styles.css", "./styles-print.css", "./styles-print-v39.css", "./styles-print-orient.css?v=69",
  "./styles-v18-extra.css", "./styles-salary.css", "./styles-v27.css",
  "./styles-header-fix.css", "./styles-ux-v38.css", "./styles-app-v42.css",
  "./main.js",
  "./main-app-1.js?v=69", "./main-app-2.js?v=69",
  "./salary-estimator.js?v=69", "./app-p1.js?v=69", "./app-p1-extra.js?v=69",
  "./app-v42-overlay.js?v=69", "./side-job-patch.js?v=69", "./sync-fix-v48.js?v=69",
  "./month-fix.js?v=69", "./print-fix-v51.js?v=69", "./ot-total-patch.js?v=69",
  "./p0-critical-fix.js?v=69", "./month-history-v65.js?v=69",
  "./sync-cross-v66.js?v=69", "./print-orient-v67.js?v=69",
  "./mobile-cards.js?v=69",
  "./i18n.js", "./modal.js", "./utils.js", "./constants.js", "./holiday-picker.js",
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
