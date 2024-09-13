import { captureRemixErrorBoundaryError } from "@sentry/remix";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import { useNetworkConnectivity, usePWAManager } from "@remix-pwa/client";
import { ManifestLink, useSWEffect, sendSkipWaitingMessage } from "@remix-pwa/sw";
import { LoaderFunction, MetaFunction } from "@remix-run/node";
import { honeypot } from "~/services/honeypot.server";
import { HoneypotProvider } from "remix-utils/honeypot/react";

import "./tailwind.css";
import dsfrCss from "@codegouvfr/react-dsfr/main.css?url";
import dsfrColorCss from "@codegouvfr/react-dsfr/dsfr/utility/colors/colors.min.css?url";
import dsfrWebManifest from "@codegouvfr/react-dsfr/favicon/manifest.webmanifest?url";
import dsfrFavicon from "@codegouvfr/react-dsfr/favicon/favicon.ico?url";
import dsfrFaviconSvg from "@codegouvfr/react-dsfr/favicon/favicon.svg?url";
import dsfrAppleTouchIcon from "@codegouvfr/react-dsfr/favicon/apple-touch-icon.png?url";
import RootDisplay from "./components/RootDisplay";
import NotFound from "./routes/404";
import UnexpectedError from "./components/UnexpectedError";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Zacharie | Ministère de l'Agriculture" },
    {
      name: "og:title",
      content: "Zacharie | FEI | Ministère de l'Agriculture",
    },
    {
      name: "description",
      content: "Garantir une meilleure qualité sanitaires des viandes de gibier sauvage mises sur le marché",
    },
  ];
};
interface WindowEnv {
  NODE_ENV: string;
  VAPID_PUBLIC_KEY: string;
}
// Augment the global Window interface
declare global {
  interface Window {
    ENV: WindowEnv;
  }
}

export function loader(): ReturnType<LoaderFunction> {
  return {
    honeypotInputProps: honeypot.getInputProps(),
    ENV: JSON.stringify({
      NODE_ENV: process.env.NODE_ENV,
      VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY as string,
    } satisfies WindowEnv),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning={true} className="h-screen">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="apple-touch-icon" href={dsfrAppleTouchIcon} />
        <link rel="icon" href={dsfrFaviconSvg} type="image/svg+xml" />
        <link rel="shortcut icon" href={dsfrFavicon} type="image/x-icon" />
        <link rel="manifest" href={dsfrWebManifest} crossOrigin="use-credentials" />
        <link rel="stylesheet" href={dsfrCss} />
        <link rel="stylesheet" href={dsfrColorCss} />

        <Meta />
        {/* https://remix-pwa.run/docs/main/web-manifest#registering-the-web-manifest */}
        <ManifestLink />
        <Links />
      </head>
      <body className="h-screen">
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const ErrorBoundary = () => {
  // https://stackoverflow.com/a/76449254/5225096
  const error = useRouteError() as Error;
  captureRemixErrorBoundaryError(error);
  console.log("error", error);
  if (!isRouteErrorResponse(error)) {
    return null;
  }
  return <RootDisplay>{error.status === 404 ? <NotFound /> : <UnexpectedError />}</RootDisplay>;
};

export default function App() {
  const { ENV, honeypotInputProps } = useLoaderData<typeof loader>();
  const [isOffline, setIsOffline] = useState(false);
  useSWEffect();
  useNetworkConnectivity({
    onOnline: () => {
      setIsOffline(false);
    },

    onOffline: () => {
      setIsOffline(true);
    },
  });
  const { swUpdate } = usePWAManager();

  return (
    <>
      {isOffline && (
        <p className="bg-action-high-blue-france text-white text-sm px-4 py-2">
          Vous n'avez pas internet. Les FEI que vous créez/modifiez actuellement seront synchronisées automatiquement
          lorsque vous aurez retrouvé une connection.
        </p>
      )}
      {swUpdate.isUpdateAvailable && (
        <div className="bg-background text-foreground fixed bottom-6 right-6">
          <p>Nouvelle version disponible</p>
          <button
            onClick={() => {
              sendSkipWaitingMessage(swUpdate.newWorker!);
              window.location.reload();
            }}
          >
            Mettre à jour
          </button>
        </div>
      )}
      <HoneypotProvider {...honeypotInputProps}>
        <Outlet />
      </HoneypotProvider>

      <script
        suppressHydrationWarning
        type="text/javascript"
        dangerouslySetInnerHTML={{
          __html: `window.ENV=${ENV};`,
        }}
      />
    </>
  );
}

// export function HydrateFallback() {
//   return <p>Chargement...</p>;
// }
