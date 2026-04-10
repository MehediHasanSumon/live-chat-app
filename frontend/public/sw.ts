/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_NAME = "live-chat-v1";
const STATIC_ASSETS = ["/_next/static", "/styles/", "/fonts/", "/icons/"];

/**
 * Install event: Cache critical assets
 */
self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Cache critical assets for offline support
      return Promise.all([
        cache.add("/"),
        // Cache only if available, don't fail if missing
        cache.addAll([]).catch(() => {}),
      ]);
    }),
  );

  // Force service worker to become active
  self.skipWaiting();
});

/**
 * Activate event: Clean up old caches
 */
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );

  self.clients.claim();
});

/**
 * Fetch event: Network-first strategy with cache fallback
 */
self.addEventListener("fetch", (event: FetchEvent) => {
  const { request } = event;

  // Only handle GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip API calls to broadcasting/auth and WebSocket connections
  if (request.url.includes("/broadcasting/") || request.url.includes("/ws") || request.url.includes("blob:")) {
    return;
  }

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok && shouldCache(request.url)) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        // Return cached response on network failure
        const cachedResponse = await caches.match(request);

        if (cachedResponse) {
          return cachedResponse;
        }

        if (request.destination === "document") {
          const cachedHomePage = await caches.match("/");
          return cachedHomePage ?? new Response("Offline", { status: 503 });
        }

        return new Response("Not available offline", { status: 503 });
      }),
  );
});

/**
 * Determine if response should be cached
 */
function shouldCache(url: string): boolean {
  // Cache static assets
  if (STATIC_ASSETS.some((asset) => url.includes(asset))) {
    return true;
  }

  // Don't cache API calls by default
  if (url.includes("/api/")) {
    return false;
  }

  // Cache HTML pages
  if (url.endsWith("/") || url.endsWith(".html")) {
    return true;
  }

  return false;
}

/**
 * Handle messages from clients
 */
self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const { type } = event.data;

  if (type === "SKIP_WAITING") {
    self.skipWaiting();
  }

  if (type === "CLEAR_CACHE") {
    caches.delete(CACHE_NAME);
  }
});

export {};
