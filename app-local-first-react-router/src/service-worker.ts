// sw.ts
/// <reference lib="webworker" />

import * as IDB from 'idb-keyval';

const CACHE_NAME = 'zacharie-pwa-cache-v3';
const previousCacheNames = ['zacharie-pwa-cache-v0', 'zacharie-pwa-cache-v1', 'zacharie-pwa-cache-v2'];

/*

CACHE ALL ASSETS TO NAVIGATE OFFLINE



*/

declare interface PrecacheEntry {
  integrity?: string;
  url: string;
  revision?: string | null;
}
declare let self: ServiceWorkerGlobalScope;

// This array will be populated at build time with the list of all assets in build-spa/client
const ASSETS_TO_CACHE: Array<PrecacheEntry | string> = self.__WB_MANIFEST || [];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log('Caching assets:', ASSETS_TO_CACHE);
        return Promise.all(
          ASSETS_TO_CACHE.map((entry) => {
            if (typeof entry === 'string') {
              return cache.add(entry);
            } else {
              return cache.add(entry.url);
            }
          }),
        );
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
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

/*

HANDLE GET REQUESTS

*/

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method === 'POST') {
    // we dont care, we are local first
    // event.respondWith(handlePostRequest(event.request));
  } else {
    event.respondWith(handleFetchRequest(event.request));
  }
});

async function handleFetchRequest(request: Request): Promise<Response> {
  if (request.method !== 'GET') {
    return fetch(request);
  }
  if (navigator.onLine) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        if (request.url === `${import.meta.env.VITE_API_URL}/api/loader/feis`) {
          const feiResponseCloned = response.clone();
          const feiData = await feiResponseCloned?.json();
          // Calculate the badge count
          const badgeCount =
            (feiData?.feisUnderMyResponsability?.length || 0) + (feiData?.feisToTake?.length || 0);
          if (navigator.setAppBadge) {
            console.log('navigator.setAppBadge', badgeCount);
            navigator.setAppBadge(badgeCount);
          } else {
            console.log('navigator.setAppBadge not available');
          }
        }
      }
      return response;
    } catch (error) {
      console.error('Fetch failed; attempting to retrieve from cache', error);
    }
  }

  if (request.url.startsWith('chrome-extension://')) {
    return fetch(request);
  }

  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  const indexHtml = await caches.match('/index.html');
  if (indexHtml) {
    return indexHtml;
  }

  return new Response(
    `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
        <meta charset="UTF-8">
        <title>Erreur</title>
    </head>
    <body>
        <h1>Désolé, une erreur est survenue et votre requête n'a pas pu aboutir.</h1>
        <p>Vous pouvez soit <a href="#" onclick="window.location.reload();">recharger votre page</a>, ou transmettre une capture d'écran à l'équipe technique pour investiguer davantage.</p>
        <p>URL: ${request.url}</p>
        <p>Méthode: ${request.method}</p>
    </body>
    </html>
    `,
    {
      status: 404,
      headers: { 'Content-Type': 'text/html' },
    },
  );
}

// async function fetchAllFeis(calledFrom: string) {
//   if (!navigator.onLine) {
//     return;
//   }
//   console.log('fetchAllFeis called from', calledFrom);
//   const cache = await caches.open(CACHE_NAME);
//   const response = await fetch(
//     `${import.meta.env.VITE_API_URL}/api/loader/feis?calledFrom=sw+${calledFrom}`,
//     {
//       method: 'GET',
//       credentials: 'include',
//       headers: new Headers({
//         Accept: 'application/json',
//         'Content-Type': 'application/json',
//       }),
//     },
//   );
//   if (response.ok) {
//     await cache.put(`${import.meta.env.VITE_API_URL}/api/loader/feis`, response.clone());
//   }
//   return response;
// }

const store = IDB.createStore('OfflineQueue', 'requests');

interface SerializedRequest {
  url: string;
  method: string;
  credentials: RequestCredentials;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

// async function queuePostRequest(request: Request) {
//   const clonedRequest = request.clone();
//   const bodyText = await clonedRequest.text();

//   const now = Date.now();

//   const serialized: SerializedRequest = {
//     url: clonedRequest.url,
//     method: clonedRequest.method,
//     credentials: clonedRequest.credentials,
//     headers: Object.fromEntries(clonedRequest.headers),
//     body: bodyText,
//     timestamp: now,
//   };

//   await IDB.set(now, serialized, store);
//   console.log('Request queued', serialized);
// }

async function processOfflineQueue(processingFrom: string) {
  console.log('Processing offline queue from', processingFrom);
  if (!navigator.onLine) {
    console.log('No network so no process ofline queue');
    return;
  }
  const allKeys = await IDB.keys(store);

  // Process requests in order: fei, carcasse, then others
  for (const key of allKeys.sort((a, b) => Number(a) - Number(b))) {
    console.log('processing key', key);
    const request = (await IDB.get(key, store)) satisfies SerializedRequest | undefined;
    if (!request) {
      continue;
    }
    try {
      const response = await fetch(
        new Request(request.url, {
          method: request.method,
          credentials: request.credentials,
          headers: request.headers,
          body: request.body,
        }),
      );
      if (response.ok) {
        await IDB.del(key, store);
        console.log('Processed and removed request', request.url);
      } else {
        console.error('Failed to process request', request.url, response.status);
      }
    } catch (error) {
      console.error('Error processing request', request.url, error);
    }
  }

  console.log('Finished processing offline queue');
}

/*


BRIDGE BETWEEN SERVICE WORKER AND CLIENT


*/
async function syncBackOnline(calledFrom: string) {
  await processOfflineQueue(calledFrom);
  // await fetchAllFeis(calledFrom);
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'SW_MESSAGE_CLEAR_CACHE') {
    for (const _cache_name of [CACHE_NAME, ...previousCacheNames]) {
      caches.delete(_cache_name).then(() => {
        console.log('Cache cleared');
      });
    }
  }

  if (event.data === 'SW_MESSAGE_BACK_TO_ONLINE') {
    console.log('back to online triggered');
    event.waitUntil(syncBackOnline('SW_MESSAGE_BACK_TO_ONLINE'));
  }

  if (event.data.type === 'TABLEAU_DE_BORD_OPEN') {
    if (navigator.onLine) {
      event.waitUntil(syncBackOnline('TABLEAU_DE_BORD_OPEN'));
    }
  }
});

/*


PUSH NOTIFICATIONS


*/
self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      const data = event.data?.json() ?? {
        title: 'Zacharie Notification',
        body: 'No payload',
        img: '/pwa-192x192.png',
      };

      // Fetch all FEIs first
      // await fetchAllFeis('PUSH_NOTIFICATION');

      // Get the cached FEI data
      const cache = await caches.open(CACHE_NAME);
      const feiResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/feis`);
      const feiResponseCloned = feiResponse?.clone();
      const feiData = await feiResponseCloned?.json();

      // Calculate the badge count
      const badgeCount =
        (feiData?.feisUnderMyResponsability?.length || 0) + (feiData?.feisToTake?.length || 0);

      const options: NotificationOptions = {
        body: data.body,
        icon: data.img || '/favicon.svg',
        badge: badgeCount,
      };

      await self.registration.showNotification(data.title, options);
      await processOfflineQueue('PUSH_NOTIFICATION');
    })(),
  );
});

export {};
