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
import "@codegouvfr/react-dsfr/main.css";

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
        {/* <ConsentBannerAndConsentManagement /> */}
        <Header
          brandTop={
            <>
              Ministère
              <br />
              de l'Agriculture
            </>
          }
          homeLinkProps={{
            href: "/",
            title: "Zacharie - Ministère de l'Agriculture",
          }}
          id="fr-header-header-with-quick-access-items"
          quickAccessItems={[
            {
              linkProps: {
                to: "connexion",
              },
              iconId: "ri-account-box-line",
              text: "Se connecter / Créer un espace",
            },
            // {
            //   iconId: "fr-icon-add-circle-line",
            //   linkProps: {
            //     href: "#",
            //   },
            //   text: "Créer un espace",
            // },
            {
              iconId: "fr-icon-mail-fill",
              linkProps: {
                href: "mailto:contact@code.gouv.fr",
              },
              text: "Contact us",
            },
          ]}
          serviceTagline="La Fiche d’Examen Initial (FEI) simplifiée"
          serviceTitle="Zacharie"
        />
        {children}
        <Footer
          accessibility="fully compliant"
          contentDescription={`
            Zacharie c’est un service à destination des chasseurs et des acteurs de la filière de valorisation des viandes de gibier sauvage (collecteurs, ETG, SVI). Elle permet aux chasseurs de créer des fiches d’examen initial en un format numérique unique, partagé, modifiable et traçable par tous les acteurs.\u000A\u000A



            Zacharie a pour objectif premier d’améliorer le niveau de complétude et de fiabilité des informations sanitaires et de traçabilité relatives aux viandes de gibier traitées. Ainsi, Zacharie contribue à améliorer la qualité sanitaire des viandes mises sur le marché, réduire les risques d’intoxication alimentaire et de gaspillage alimentaire.
            `}
          termsLinkProps={{
            href: "#",
          }}
          websiteMapLinkProps={{
            href: "#",
          }}
          // bottomItems={[
          //     headerFooterDisplayItem,
          //     <FooterPersonalDataPolicyItem />,
          //     <FooterConsentManagementItem />
          // ]}
        />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export const ErrorBoundary = () => {
  const error = useRouteError();
  captureRemixErrorBoundaryError(error);
  return <div>Something went wrong</div>;
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