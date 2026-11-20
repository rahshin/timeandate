/* CACHE and ASSETS are generated from the production build. */
const cachePrefix = "timeandate-interval-timer-";
const shell = "/interval-timer-app/";

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(
    ASSETS.map(path => new Request(path, { cache: "reload" })),
  )));
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;

  const navigation = request.mode === "navigate" && url.pathname.startsWith(shell);
  if (!navigation && !ASSETS.includes(url.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(navigation ? shell : url.pathname);
    return cached || fetch(request);
  })());
});
