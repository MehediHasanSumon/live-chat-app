const CACHE_NAME = "live-chat-v1";
const STATIC_ASSETS = ["/_next/static", "/styles/", "/fonts/", "/icons/"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.all([
        cache.add("/"),
        cache.addAll([]).catch(() => {}),
      ]);
    }),
  );

  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }

          return Promise.resolve(false);
        }),
      );
    }),
  );

  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  if (
    request.url.includes("/broadcasting/") ||
    request.url.includes("/ws") ||
    request.url.includes("blob:")
  ) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok && shouldCache(request.url)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }

        return response;
      })
      .catch(async () => {
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.destination === "document") {
          const cachedHomePage = await caches.match("/");
          return cachedHomePage || new Response("Offline", { status: 503 });
        }

        return new Response("Not available offline", { status: 503 });
      }),
  );
});

function shouldCache(url) {
  if (STATIC_ASSETS.some((asset) => url.includes(asset))) {
    return true;
  }

  if (url.includes("/api/")) {
    return false;
  }

  if (url.endsWith("/") || url.endsWith(".html")) {
    return true;
  }

  return false;
}

self.addEventListener("message", (event) => {
  const { type } = event.data || {};

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (type === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME);
  }
});
