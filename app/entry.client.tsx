import * as Sentry from "@sentry/remix";
/**
 * By default, Remix will handle hydrating your app on the client for you.
 * You are free to delete this file if you'd like to, but if you ever want it revealed again, you can run `npx remix reveal` ✨
 * For more information, see https://remix.run/file-conventions/entry.client
 */

// import("./pwa");

import { RemixBrowser, Link, useLocation, useMatches } from "@remix-run/react";
import { startTransition, StrictMode, useEffect } from "react";
import { hydrateRoot } from "react-dom/client";
import { startReactDsfr } from "@codegouvfr/react-dsfr/spa";

Sentry.init({
  dsn: "https://169fc757825672212dc0073c4c64bff7@sentry.incubateur.net/175",
  tracesSampleRate: 0.01,
  replaysSessionSampleRate: 0.01,
  replaysOnErrorSampleRate: 0.01,
  enabled: false,
  integrations: [
    Sentry.browserTracingIntegration({
      useEffect,
      useLocation,
      useMatches,
    }),
    // eslint-disable-next-line import/namespace
    Sentry.replayIntegration(),
  ],
});

declare module "@codegouvfr/react-dsfr/spa" {
  interface RegisterLink {
    Link: typeof Link;
  }
}

startTransition(() => {
  startReactDsfr({
    Link,
    defaultColorScheme: "light",
    verbose: false,
  });
  hydrateRoot(
    document,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
