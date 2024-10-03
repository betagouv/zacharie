// sw.ts
/// <reference lib="webworker" />
import {
  formatFeiOfflineQueue,
  formatFeiOfflineQueueCarcasse,
  formatFeiOfflineQueueFeiIntermediaire,
  type FeiAction,
} from "~/db/fei.client";
import type { FeiWithRelations } from "~/db/fei.server";
import type { Fei, Carcasse, FeiIntermediaire } from "@prisma/client";
import type { MeLoaderData } from "~/routes/api.loader.me";
import type { MyRelationsLoaderData } from "~/routes/api.loader.my-relations";
import type { FeisLoaderData } from "~/routes/api.loader.fei";
import type { FeiLoaderData } from "~/routes/api.loader.fei.$fei_numero";
import type { FeiActionData } from "~/routes/api.action.fei.$fei_numero";
import type { CarcasseLoaderData } from "~/routes/api.loader.carcasse.$fei_numero.$numero_bracelet";
import type { CarcasseActionData } from "~/routes/api.action.carcasse.$numero_bracelet";
import type { FeiIntermediaireActionData } from "~/routes/api.action.fei-intermediaire.$intermediaire_id";
import { createStore, set, get, del, keys } from "idb-keyval";
import { formatCarcasseOfflineActionReturn } from "./db/carcasse.client";

const CACHE_NAME = "zacharie-pwa-cache-v1";
const previousCacheNames = ["zacharie-pwa-cache-v0"];

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

self.addEventListener("install", (event: ExtendableEvent) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        console.log("Caching assets:", ASSETS_TO_CACHE);
        return Promise.all(
          ASSETS_TO_CACHE.map((entry) => {
            if (typeof entry === "string") {
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

/*

HANDLE GET REQUESTS TO PUT IN CACHE TO USE OFFLINE TOO
AND HANDLE POST REQUESTS TO QUEUE WHEN OFFLINE

*/

self.addEventListener("fetch", (event: FetchEvent) => {
  if (event.request.method === "POST") {
    console.log("AIAIAIAIE POST REQUEST", event.request.url);
    event.respondWith(handlePostRequest(event.request));
  } else {
    event.respondWith(handleFetchRequest(event.request));
  }
});

/*

HANDLE GET REQUESTS

*/

async function handleFetchRequest(request: Request): Promise<Response> {
  if (request.method !== "GET") {
    return fetch(request);
  }
  if (navigator.onLine) {
    try {
      const response = await fetch(request);
      if (response.ok) {
        const cache = await caches.open(CACHE_NAME);
        cache.put(request, response.clone());
        if (request.url === `${import.meta.env.VITE_API_URL}/api/loader/fei`) {
          const feiResponseCloned = response.clone();
          const feiData = await feiResponseCloned?.json();
          // Calculate the badge count
          const badgeCount = (feiData?.feisUnderMyResponsability?.length || 0) + (feiData?.feisToTake?.length || 0);
          if (navigator.setAppBadge) {
            console.log("navigator.setAppBadge", badgeCount);
            navigator.setAppBadge(badgeCount);
          } else {
            console.log("navigator.setAppBadge not available");
          }
        }
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
      const allFeisCacheCloned = allFeisCache.clone();
      const allFeisData = (await allFeisCacheCloned.json()) as FeisLoaderData;
      const feiNumero = request.url.split("/").pop() as string;
      const specificFei = findFeiInAllFeisData(allFeisData, feiNumero);

      if (specificFei) {
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              fei: specificFei,
            },
            error: "",
          } satisfies FeiLoaderData),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  }
  // If it's a specific FEI request and we don't have it cached, try to find it in the all-FEIs cache
  if (request.url.includes(`${import.meta.env.VITE_API_URL}/api/loader/carcasse/`)) {
    const allFeisCache = await caches.match(new Request(`${import.meta.env.VITE_API_URL}/api/loader/fei`));
    if (allFeisCache) {
      const allFeisCacheCloned = allFeisCache.clone();
      const allFeisData = (await allFeisCacheCloned.json()) as FeisLoaderData;
      const bracelet = request.url.split("/").at(-1) as string;
      const feiNumero = request.url.split("/").at(-2) as string;
      const specificFei = findFeiInAllFeisData(allFeisData, feiNumero);

      if (specificFei) {
        const carcasse = specificFei.Carcasses.find((c) => c.numero_bracelet === bracelet)!;
        return new Response(
          JSON.stringify({
            ok: true,
            data: {
              carcasse: { ...carcasse, Fei: specificFei as Fei },
              fei: specificFei,
            },
            error: "",
          } satisfies CarcasseLoaderData),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }
    }
  }

  return new Response(`Offline and data not available\n${JSON.stringify(request, null, 2)}`, {
    status: 404,
    headers: { "Content-Type": "text/plain" },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function findFeiInAllFeisData(allFeisData: FeisLoaderData, feiNumero: string) {
  const allFeis = [
    ...allFeisData.feisUnderMyResponsability,
    ...allFeisData.feisToTake,
    ...allFeisData.feisOngoing,
    // ...allFeisData.feisDone,
  ];
  return allFeis.find((fei) => fei.numero === feiNumero) as FeiWithRelations;
}

async function fetchAllFeis(calledFrom: string) {
  if (!navigator.onLine) {
    return;
  }
  console.log("fetchAllFeis called from", calledFrom);
  const cache = await caches.open(CACHE_NAME);
  const response = await fetch(`${import.meta.env.VITE_API_URL}/api/loader/fei?calledFrom=sw+${calledFrom}`, {
    method: "GET",
    credentials: "include",
    headers: new Headers({
      Accept: "application/json",
      "Content-Type": "application/json",
    }),
  });
  if (response.ok) {
    await cache.put(`${import.meta.env.VITE_API_URL}/api/loader/fei`, response.clone());
  }
  return response;
}

/*

HANDLE POST REQUESTS

*/

async function handlePostRequest(request: Request): Promise<Response> {
  try {
    if (navigator.onLine) {
      try {
        const response = await fetch(request);
        return response;
      } catch (error) {
        console.error("POST request failed; queueing for later", error);
      }
    }

    console.log("POST request received while offline; queueing for later");
    await queuePostRequest(request);
    console.log("Request queued for later execution");
    // Handle FEI creation when offline
    if (request.url.includes(`/api/action/fei/`)) {
      console.log("Handling offline FEI creation");
      /* Fei action */
      console.log("Cloning request");
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData();
      const feiData = Object.fromEntries(formData) as unknown as Fei;
      console.log("Opening cache");
      const cache = await caches.open(CACHE_NAME);
      /* User */
      console.log("USerResponse from cache");
      const userResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/me`);
      console.log("CLone user response");
      const userResponseClone = userResponse!.clone();
      console.log("User data from cache");
      const userData = (await userResponseClone.json()) as MeLoaderData;
      /* My Relations */
      console.log("MyRelationsResponse from cache");
      const myRelationsResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/my-relations`);
      console.log("Clone my relations response");
      const myRelationsResponseClone = myRelationsResponse!.clone();
      console.log("My relations data from cache");
      const myRelationsData = (await myRelationsResponseClone.json()) as MyRelationsLoaderData;
      /* All Feis */
      console.log("AllFeisResponse from cache");
      const allFeisResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
      console.log("Clone all feis response");
      const allFeisResponseClone = allFeisResponse!.clone();
      console.log("All feis data from cache");
      const allFeisData = (await allFeisResponseClone.json()) as FeisLoaderData;
      console.log("Specific fei populated");
      const specificFeiPopulated = findFeiInAllFeisData(allFeisData, feiData.numero);
      console.log("Specific fei populated", specificFeiPopulated);
      /* Treatment */
      const offlineFei = formatFeiOfflineQueue(
        specificFeiPopulated,
        feiData,
        userData.data.user!,
        myRelationsData.data!,
        formData.get("step") as FeiAction,
      );
      console.log("Offline FEI", offlineFei);
      await addOfflineFeiToCache(offlineFei);
      console.log("Offline FEI added to cache");
      return new Response(JSON.stringify({ ok: true, data: offlineFei, error: "" } satisfies FeiActionData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.url.includes(`/api/action/carcasse/`)) {
      console.log("Handling offline carcasse examination");
      /* Carcasse action */
      console.log("Cloning request");
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData();
      const carcasseData = Object.fromEntries(formData) as unknown as Carcasse;
      console.log("Opening cache");
      const cache = await caches.open(CACHE_NAME);
      /* All Feis */
      console.log("AllFeisResponse from cache");
      const allFeisResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
      console.log("Clone all feis response");
      const allFeisResponseClone = allFeisResponse!.clone();
      console.log("All feis data from cache");
      const allFeisData = (await allFeisResponseClone.json()) as FeisLoaderData;
      console.log("Specific fei populated");
      const specificFeiPopulated = findFeiInAllFeisData(allFeisData, carcasseData.fei_numero);
      console.log("Specific fei populated", specificFeiPopulated);
      const carcasseActionData = formatCarcasseOfflineActionReturn(
        carcasseData,
        specificFeiPopulated.Carcasses.find((c) => c.numero_bracelet === carcasseData.numero_bracelet) ?? null,
      );
      /* Treatment */
      const offlineFei = formatFeiOfflineQueueCarcasse(specificFeiPopulated!, carcasseActionData.data!);
      console.log("Offline FEI", offlineFei);
      await addOfflineFeiToCache(offlineFei);
      console.log("Offline FEI added to cache");
      // FIXME: return carcasse data
      return new Response(JSON.stringify(carcasseActionData satisfies CarcasseActionData), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (request.url.includes(`/api/action/fei-intermediaire/`)) {
      console.log("Handling offline fei-intermediaire creation");
      /* Fei Intermediaire action */
      console.log("Cloning request");
      const clonedRequest = request.clone();
      const formData = await clonedRequest.formData();
      const feiIntermediaire = Object.fromEntries(formData) as unknown as FeiIntermediaire;
      console.log("Opening cache");
      const cache = await caches.open(CACHE_NAME);
      /* User */
      console.log("USerResponse from cache");
      const userResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/me`);
      console.log("CLone user response");
      const userResponseClone = userResponse!.clone();
      console.log("User data from cache");
      const userData = (await userResponseClone.json()) as MeLoaderData;
      /* My Relations */
      console.log("MyRelationsResponse from cache");
      const myRelationsResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/my-relations`);
      console.log("Clone my relations response");
      const myRelationsResponseClone = myRelationsResponse!.clone();
      console.log("My relations data from cache");
      const myRelationsData = (await myRelationsResponseClone.json()) as MyRelationsLoaderData;
      /* All Feis */
      console.log("AllFeisResponse from cache");
      const allFeisResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
      console.log("Clone all feis response");
      const allFeisResponseClone = allFeisResponse!.clone();
      console.log("All feis data from cache");
      const allFeisData = (await allFeisResponseClone.json()) as FeisLoaderData;
      console.log("Specific fei populated");
      const specificFeiPopulated = findFeiInAllFeisData(allFeisData, feiIntermediaire.fei_numero);
      console.log("Specific fei populated", specificFeiPopulated);
      /* Treatment */
      const offlineFei = formatFeiOfflineQueueFeiIntermediaire(
        specificFeiPopulated!,
        feiIntermediaire,
        userData.data.user!,
        myRelationsData.data!,
      );
      console.log("Offline FEI", offlineFei);
      await addOfflineFeiToCache(offlineFei);
      console.log("Offline FEI added to cache");
      // FIXME: return fei data
      return new Response(
        JSON.stringify({
          ok: true,
          data: offlineFei.FeiIntermediaires.find((inter) => inter.id === feiIntermediaire.id)!,
          error: "",
        } satisfies FeiIntermediaireActionData),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true, data: "Request queued for later execution" }), {
      status: 202,
      headers: { "Content-Type": "application/json" },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } catch (e: any) {
    console.log("Error handling POST request", e.message);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

const store = createStore("OfflineQueue", "requests");

interface SerializedRequest {
  url: string;
  method: string;
  credentials: RequestCredentials;
  headers: Record<string, string>;
  body: string;
  timestamp: number;
}

async function queuePostRequest(request: Request) {
  const clonedRequest = request.clone();
  const bodyText = await clonedRequest.text();

  const serialized: SerializedRequest = {
    url: clonedRequest.url,
    method: clonedRequest.method,
    credentials: clonedRequest.credentials,
    headers: Object.fromEntries(clonedRequest.headers),
    body: bodyText,
    timestamp: Date.now(),
  };

  await set(clonedRequest.url, serialized, store);
  console.log("Request queued", serialized);
}

async function processOfflineQueue(processingFrom: string) {
  console.log("Processing offline queue from", processingFrom);

  const allKeys = await keys(store);
  for (const key of allKeys) {
    const request = (await get(key, store)) satisfies SerializedRequest | undefined;
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
        await del(key, store);
        console.log("Processed and removed request", request.url);
      } else {
        console.error("Failed to process request", request.url, response.status);
      }
    } catch (error) {
      console.error("Error processing request", request.url, error);
    }
  }

  console.log("Finished processing offline queue");
}

async function addOfflineFeiToCache(offlineFei: ReturnType<typeof formatFeiOfflineQueue>) {
  console.log("Adding offline FEI to cache");
  const cache = await caches.open(CACHE_NAME);

  await cache
    .put(
      `${import.meta.env.VITE_API_URL}/api/loader/fei/${offlineFei.numero}`,
      new Response(
        JSON.stringify({
          ok: true,
          data: {
            fei: offlineFei,
          },
          error: "",
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    )
    .then(() => {
      console.log("Offline FEI added to cache");
    })
    .catch((error) => {
      console.error("Error adding offline FEI to cache", error);
    });

  console.log("Fetching all FEIs from cache");
  const allFeisResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
  if (allFeisResponse) {
    console.log("All FEIs data found in cache");
    const allFeisResponseClone = allFeisResponse.clone();
    console.log("All FEIs data from cache");
    const allFeisData = (await allFeisResponseClone.json()) as FeisLoaderData;
    console.log("Updating all FEIs data");
    allFeisData.feisUnderMyResponsability = [
      ...allFeisData.feisUnderMyResponsability.filter((fei: Fei) => fei.numero !== offlineFei.numero),
      offlineFei,
    ];

    console.log("Putting updated all FEIs data in cache");
    await cache.put(
      `${import.meta.env.VITE_API_URL}/api/loader/fei`,
      new Response(JSON.stringify(allFeisData), {
        headers: { "Content-Type": "application/json" },
      }),
    );
    console.log("All FEIs data updated in cache");
  } else {
    console.log("No all FEIs data found in cache");
  }
}
/*


BRIDGE BETWEEN SERVICE WORKER AND CLIENT


*/

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  if (event.data === "skipWaiting") {
    self.skipWaiting();
  }

  if (event.data === "SW_MESSAGE_CLEAR_CACHE") {
    for (const _cache_name of [CACHE_NAME, ...previousCacheNames]) {
      caches.delete(_cache_name).then(() => {
        console.log("Cache cleared");
      });
    }
  }

  if (event.data === "SW_MESSAGE_BACK_TO_ONLINE") {
    console.log("back to online triggered");
    event.waitUntil(
      Promise.all([fetchAllFeis("SW_MESSAGE_BACK_TO_ONLINE"), processOfflineQueue("SW_MESSAGE_BACK_TO_ONLINE")]),
    );
  }

  if (event.data.type === "TABLEAU_DE_BORD_OPEN") {
    event.waitUntil(Promise.all([fetchAllFeis("TABLEAU_DE_BORD_OPEN"), processOfflineQueue("TABLEAU_DE_BORD_OPEN")]));
  }
});

/*


PUSH NOTIFICATIONS


*/
self.addEventListener("push", (event: PushEvent) => {
  event.waitUntil(
    (async () => {
      const data = event.data?.json() ?? {
        title: "Zacharie Notification",
        body: "No payload",
        img: "/pwa-192x192.png",
      };

      // Fetch all FEIs first
      await fetchAllFeis("PUSH_NOTIFICATION");

      // Get the cached FEI data
      const cache = await caches.open(CACHE_NAME);
      const feiResponse = await cache.match(`${import.meta.env.VITE_API_URL}/api/loader/fei`);
      const feiResponseCloned = feiResponse?.clone();
      const feiData = await feiResponseCloned?.json();

      // Calculate the badge count
      const badgeCount = (feiData?.feisUnderMyResponsability?.length || 0) + (feiData?.feisToTake?.length || 0);

      const options: NotificationOptions = {
        body: data.body,
        icon: data.img || "/favicon.svg",
        badge: badgeCount,
      };

      await self.registration.showNotification(data.title, options);
      await processOfflineQueue("PUSH_NOTIFICATION");
    })(),
  );
});

export {};
