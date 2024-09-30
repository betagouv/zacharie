// sw.ts
/// <reference lib="webworker" />

const CACHE_NAME = "zacharie-pwa-cache-v1";
const previousCacheNames = ["zacharie-pwa-cache-v0"];

declare interface PrecacheEntry {
  integrity?: string;
  url: string;
  revision?: string | null;
}
declare let self: ServiceWorkerGlobalScope;

// This array will be populated at build time with the list of all assets in build-spa/client
const ASSETS_TO_CACHE: Array<PrecacheEntry | string> = self.__WB_MANIFEST;

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE.filter((entry) => typeof entry !== "string").map((asset) => asset.url));
    }),
  );
});

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
});

self.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      if (response) {
        return response;
      }
      return fetch(event.request).then((response) => {
        if (!response || response.status !== 200 || response.type !== "basic") {
          return response;
        }
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });
        return response;
      });
    }),
  );
});

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }

  if (event.data === "clearCache") {
    for (const _cache_name of [CACHE_NAME, ...previousCacheNames]) {
      caches.delete(_cache_name).then(() => {
        console.log("Cache cleared");
      });
    }
  }

  // Add a new message type for manual sync
  if (event.data === "manualSync") {
    // Perform sync operations here
    console.log("Manual sync triggered");
    // Implement your sync logic here
  }
});

self.addEventListener("push", (event: PushEvent) => {
  const options: NotificationOptions = {
    body: event.data?.text() ?? "No payload",
    icon: "/pwa-192x192.png",
    badge: "/pwa-64x64.png",
  };

  event.waitUntil(self.registration.showNotification("Zacharie Notification", options));
});

export {}; // This empty export is necessary to make this a module
