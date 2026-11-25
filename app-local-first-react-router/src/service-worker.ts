/// <reference lib="webworker" />

import * as IDB from 'idb-keyval';

const CACHE_NAME = 'zacharie-pwa-cache-v4';

declare interface PrecacheEntry {
  integrity?: string;
  url: string;
  revision?: string | null;
}
declare let self: ServiceWorkerGlobalScope;

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
          })
        );
      })
      .then(() => self.skipWaiting())
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
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  if (event.request.method !== 'GET') return;
  if (new URL(event.request.url).origin !== self.location.origin) return;
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
      console.error('Fetch failed; attempting to retrieve from cache', error);
    }
  }

  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  if (request.mode === 'navigate') {
    const indexHtml = await caches.match('/index.html');
    if (indexHtml) {
      return indexHtml;
    }
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
    }
  );
}

const store = IDB.createStore('OfflineQueue', 'requests');

interface SerializedRequest {
  url: string;
  method: string;
  credentials: RequestCredentials;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

async function processOfflineQueue(processingFrom: string) {
  console.log('Processing offline queue from', processingFrom);
  if (!navigator.onLine) {
    console.log('No network so no process ofline queue');
    return;
  }
  const allKeys = await IDB.keys(store);

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
        })
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

async function syncBackOnline(calledFrom: string) {
  await processOfflineQueue(calledFrom);
}

self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if (event.data === 'skipWaiting') {
    self.skipWaiting();
  }

  if (event.data === 'SW_MESSAGE_CLEAR_CACHE') {
    event.waitUntil(
      caches
        .keys()
        .then((cacheNames) =>
          Promise.all(
            cacheNames
              .filter((cacheName) => cacheName !== CACHE_NAME)
              .map((cacheName) => caches.delete(cacheName))
          )
        )
        .then(() => console.log('Cache cleared'))
    );
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

  if (event.data.type === 'REGISTRE_CARCASSES_OPEN') {
    if (navigator.onLine) {
      event.waitUntil(syncBackOnline('REGISTRE_CARCASSES_OPEN'));
    }
  }
});

self.addEventListener('push', (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      await processOfflineQueue('PUSH_NOTIFICATION');
    })()
  );
});

export {};
