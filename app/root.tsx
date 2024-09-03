import { Links, Meta, Outlet, Scripts, ScrollRestoration, useLoaderData } from "@remix-run/react";
import { useNetworkConnectivity, usePWAManager } from "@remix-pwa/client";
import { ManifestLink, useSWEffect, sendSkipWaitingMessage } from "@remix-pwa/sw";
import { LoaderFunction, MetaFunction } from "@remix-run/node";
import { Header } from "@codegouvfr/react-dsfr/Header";

import "./tailwind.css";

export const meta: MetaFunction = () => {
  return [
    { title: "Zacharie" },
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
    ENV: JSON.stringify({
      NODE_ENV: process.env.NODE_ENV,
    }),
  };
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { ENV } = useLoaderData<typeof loader>();
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link
          rel="apple-touch-icon"
          href="./node_modules/@codegouvfr/react-dsfr/favicon/apple-touch-icon.png"
        />
        <link
          rel="icon"
          href="./node_modules/@codegouvfr/react-dsfr/favicon/favicon.svg"
          type="image/svg+xml"
        />
        <link
          rel="shortcut icon"
          href="./node_modules/@codegouvfr/react-dsfr/favicon/favicon.ico"
          type="image/x-icon"
        />
        <link
          rel="manifest"
          href="./node_modules/@codegouvfr/react-dsfr/favicon/manifest.webmanifest"
          crossOrigin="use-credentials"
        />

        <link rel="stylesheet" href="./node_modules/@codegouvfr/react-dsfr/main.css" />

        <Meta />
        {/* https://remix-pwa.run/docs/main/web-manifest#registering-the-web-manifest */}
        <ManifestLink />
        <Links />
      </head>
      <body>
        <Header
          brandTop={
            <>
              INTITULE
              <br />
              OFFICIEL
            </>
          }
          homeLinkProps={{
            href: "/",
            title: "Accueil - Nom de l’entité (ministère, secrétariat d‘état, gouvernement)",
          }}
          id="fr-header-header-with-quick-access-items"
          quickAccessItems={[
            {
              iconId: "fr-icon-add-circle-line",
              linkProps: {
                href: "#",
              },
              text: "Créer un espace",
            },
            {
              iconId: "fr-icon-mail-fill",
              linkProps: {
                href: "mailto:contact@code.gouv.fr",
              },
              text: "Contact us",
            },
            {
              buttonProps: {
                onClick: function noRefCheck() {},
              },
              iconId: "ri-account-box-line",
              text: "Se connecter",
            },
          ]}
          serviceTagline="baseline - précisions sur l'organisation"
          serviceTitle="Nom du site / service"
        />
        {children}
        <ScrollRestoration />
        <Scripts />
        <script
          suppressHydrationWarning
          type="text/javascript"
          dangerouslySetInnerHTML={{
            __html: `window.ENV=${ENV};`,
          }}
        />
      </body>
    </html>
  );
}

export default function App() {
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
      <Outlet />
    </>
  );
}

// export function HydrateFallback() {
//   return <p>Chargement...</p>;
// }
