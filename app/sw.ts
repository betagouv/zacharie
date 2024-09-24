/// <reference lib="webworker" />
import { cleanupOutdatedCaches, createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { clientsClaim } from "workbox-core";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { setupRoutes } from "./shared-sw";
import { ssr, navigateFallback } from "virtual:vite-pwa/remix/sw";

declare let self: ServiceWorkerGlobalScope;

const url = navigateFallback ?? "/";

// self.__WB_MANIFEST is the default injection point
const manifest = self.__WB_MANIFEST;
if (import.meta.env.DEV) {
  const entry = manifest.findIndex((entry) => typeof entry !== "string" && entry.url === url);
  if (entry !== -1) {
    manifest.splice(entry, 1);
  }
  // add the navigateFallback to the manifest
  manifest.push({ url, revision: Math.random().toString() });
}

precacheAndRoute(manifest);

// clean old assets
cleanupOutdatedCaches();

let allowlist: RegExp[] | undefined;
// in dev mode, we disable precaching to avoid caching issues
if (import.meta.env.DEV) {
  if (ssr) {
    allowlist = [new RegExp(`^${url}$`)];
  } else {
    allowlist = [/^index.html$/];
  }
}

// in ssr mode, we only intercept root page
if (import.meta.env.PROD) {
  if (ssr) {
    allowlist = [new RegExp(`^${url}$`)];
  }
}

// to allow work offline
registerRoute(new NavigationRoute(createHandlerBoundToURL(ssr ? url : "index.html"), { allowlist }));

// Add this line to ensure all routes are handled
setupRoutes();

self.skipWaiting();
clientsClaim();

// Add a catch-all route for offline support
registerRoute(({ request }) => request.mode === "navigate", createHandlerBoundToURL(ssr ? url : "index.html"));
