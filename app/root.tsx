import { captureRemixErrorBoundaryError } from "@sentry/remix";
import {
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
import { Header } from "@codegouvfr/react-dsfr/Header";
import { Footer } from "@codegouvfr/react-dsfr/Footer";
import { honeypot } from "~/services/honeypot.server";
import { HoneypotProvider } from "remix-utils/honeypot/react";

import "./tailwind.css";
import dsfrCss from "@codegouvfr/react-dsfr/main.css?url";
import dsfrColorCss from "@codegouvfr/react-dsfr/dsfr/utility/colors/colors.min.css?url";
import dsfrWebManifest from "@codegouvfr/react-dsfr/favicon/manifest.webmanifest?url";
import dsfrFavicon from "@codegouvfr/react-dsfr/favicon/favicon.ico?url";
import dsfrFaviconSvg from "@codegouvfr/react-dsfr/favicon/favicon.svg?url";
import dsfrAppleTouchIcon from "@codegouvfr/react-dsfr/favicon/apple-touch-icon.png?url";

export const meta: MetaFunction = () => {
  return [
    { title: "Zacharie | Ministère de l'Agriculture" },
    {
      name: "og:title",
      content:
        "Zacharie | Garantir une meilleure qualité sanitaires des viandes de gibier sauvage mises sur le marché",
    },
    {
      name: "description",
      content:
        "Garantir une meilleure qualité sanitaires des viandes de gibier sauvage mises sur le marché",
    },
  ];
};

export function loader(): ReturnType<LoaderFunction> {
  return {
    honeypotInputProps: honeypot.getInputProps(),
    ENV: JSON.stringify({
      NODE_ENV: process.env.NODE_ENV,
    }),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning={true}>
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
        {/* <ManifestLink /> */}
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  console.log("error", error);
  return (
    <section className="fr-container min-h-[50vh] flex flex-col justify-center my-auto">
      <div className="fr-grid-row fr-grid-row--gutters fr-py-6w flex flex-col justify-center my-auto">
        <h1 className="fr-h1">Une erreur est survenue...</h1>
      </div>
    </section>
  );
};

export default function App() {
  const { ENV, honeypotInputProps } = useLoaderData<typeof loader>();
  useSWEffect();
  useNetworkConnectivity({
    onOnline: () => {
      alert("Vous êtes en ligne");
    },

    onOffline: () => {
      alert("Vous êtes en zone blanche");
    },
  });
  const { swUpdate } = usePWAManager();

  return (
    <>
      {swUpdate.isUpdateAvailable && (
        <div className="bg-background text-foreground fixed bottom-6 right-6">
          <p>Nouvelle version disponible</p>
          <button
            onClick={() => {
              sendSkipWaitingMessage(swUpdate.newWorker!);
              window.location.reload();
            }}>
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
