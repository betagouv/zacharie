/// <reference lib="WebWorker" />
import {
  EnhancedCache,
  isDocumentRequest,
  isLoaderRequest,
  NavigationHandler,
  clearUpOldCaches,
  SkipWaitHandler,
  type DefaultFetchHandler,
} from "@remix-pwa/sw";

export {};

declare let self: ServiceWorkerGlobalScope;

self.addEventListener("install", (event) => {
  console.log("Service worker installed");

  event.waitUntil(
    assetCache.preCacheUrls(
      self.__workerManifest.assets.filter((url) => !url.endsWith(".map") && !url.endsWith(".js"))
    )
  );
});

// rest of our service worker

export const defaultFetchHandler: DefaultFetchHandler = async ({ context }) => {
  const request = context.event.request;
  const url = new URL(request.url);

  if (isDocumentRequest(request)) {
    return documentCache.handleRequest(request);
  }

  if (isLoaderRequest(request)) {
    return dataCache.handleRequest(request);
  }

  if (self.__workerManifest.assets.includes(url.pathname)) {
    return assetCache.handleRequest(request);
  }

  return fetch(request);
};

const version = "v2";

// HTML cache
const documentCache = new EnhancedCache("document-cache", {
  version,
  strategy: "NetworkFirst",
  strategyOptions: {
    maxEntries: 64,
  },
});

// CSS, JS, and other assets cache
const assetCache = new EnhancedCache("asset-cache", {
  version,
  strategy: "NetworkFirst",
  strategyOptions: {
    maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
    maxEntries: 100,
  },
});

// whatever data we fetch
const dataCache = new EnhancedCache("data-cache", {
  version,
  strategy: "NetworkFirst",
  strategyOptions: {
    networkTimeoutInSeconds: 10,
    maxEntries: 72,
  },
});

const messageHandler = new NavigationHandler({
  cache: documentCache,
});

const skipHandler = new SkipWaitHandler();

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  event.waitUntil(
    Promise.all([messageHandler.handleMessage(event), skipHandler.handleMessage(event)])
  );
});

self.addEventListener("activate", (event) => {
  console.log("Service worker activated");

  event.waitUntil(
    Promise.all([
      clearUpOldCaches(["document-cache", "asset-cache", "data-cache"], version),
      self.clients.claim(),
    ])
  );
});
