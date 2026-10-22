/* RezaOT: atomic offline releases; never touch another application's cache. */
importScripts("./release.js");
const CACHE_PREFIX = "rezaot-";
const CACHE_NAME = CACHE_PREFIX + "v" + REZAOT_RELEASE.version;
const required = Array.from(new Set(REZAOT_RELEASE.assets.concat(
  REZAOT_RELEASE.scripts.map(path => path + "?v=" + REZAOT_RELEASE.version)
)));
self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(required);
    // A failed critical asset rejects install, retaining the active version.
    // Successful upgrades wait for an explicit reload action.
  })());
});
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});
self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      !url.href.startsWith(self.registration.scope)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === "navigate") {
      const shell = await cache.match(new URL("index.html", self.registration.scope).href);
      if (shell) return shell;
    }
    const relative = url.pathname.slice(new URL(self.registration.scope).pathname.length);
    if (url.searchParams.get("v") === REZAOT_RELEASE.version && REZAOT_RELEASE.assets.includes(relative)) {
      const plain = new URL(url); plain.search = "";
      const asset = await cache.match(plain.href);
      if (asset) return asset;
    }
    return fetch(request);
  })());
});
