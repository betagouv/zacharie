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
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(ASSETS_TO_CACHE.filter((entry) => typeof entry !== "string").map((asset) => asset.url));
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              return caches.delete(cacheName);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event: FetchEvent) => {
  event.respondWith(handleFetchRequest(event.request));
});

async function handleFetchRequest(request: Request): Promise<Response> {
  if (navigator.onLine) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      console.error("Fetch failed; attempting to retrieve from cache", error);
    }
  }

  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // If it's a specific FEI request and we don't have it cached, try to find it in the all-FEIs cache
  if (request.url.includes(`${import.meta.env.VITE_API_URL}/api/loader/fei/`)) {
    const allFeisCache = await caches.match(new Request(`${import.meta.env.VITE_API_URL}/api/loader/fei`));
    if (allFeisCache) {
      const allFeisData = await allFeisCache.json();
      const feiNumero = request.url.split("/").pop() as string;
      const specificFei = findFeiInAllFeisData(allFeisData, feiNumero);

      if (specificFei) {
        return new Response(JSON.stringify({ fei: specificFei }), {
          headers: { "Content-Type": "application/json" },
        });
      }
    }
  }

  return new Response("Offline and data not available", {
    status: 404,
    headers: { "Content-Type": "text/plain" },
  });
}

function findFeiInAllFeisData(allFeisData: any, feiNumero: string) {
  const allFeis = [
    ...allFeisData.feisUnderMyResponsability,
    ...allFeisData.feisToTake,
    ...allFeisData.feisOngoing,
    ...allFeisData.feisDone,
  ];
  return allFeis.find((fei) => fei.numero === feiNumero);
}

async function fetchAllFeis() {
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
  if (response.ok) {
    await cache.put(`${import.meta.env.VITE_API_URL}/api/loader/fei`, response.clone());
  }
  return response;
}

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

  if (event.data === "manualSync") {
    console.log("Manual sync triggered");
    event.waitUntil(fetchAllFeis());
  }

  if (event.data.type === "APP_OPENED") {
    event.waitUntil(handleAppOpen());
  }
});

self.addEventListener("push", (event: PushEvent) => {
  const options: NotificationOptions = {
    body: event.data?.text() ?? "No payload",
    icon: "/pwa-192x192.png",
    badge: "/pwa-64x64.png",
  };

  event.waitUntil(Promise.all([self.registration.showNotification("Zacharie Notification", options), fetchAllFeis()]));
});

async function handleAppOpen() {
  if (navigator.onLine) {
    await fetchAllFeis();
  }
}

export {};
