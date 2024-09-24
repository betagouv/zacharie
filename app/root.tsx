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
import { LoaderFunction, MetaFunction } from "@remix-run/node";
import NotFound from "~/routes/404";
import RootDisplay from "~/components/RootDisplay";
import UnexpectedError from "~/components/UnexpectedError";
import OfflineMode from "~/components/OfflineMode";
import NouvelleVersion from "~/components/NouvelleVersion";
import InstallApp from "~/components/InstallApp";
import { PWAManifest } from "~/components/PWAManifest";

import "~/tailwind.css";
import dsfrCss from "@codegouvfr/react-dsfr/main.css?url";
import dsfrColorCss from "@codegouvfr/react-dsfr/dsfr/utility/colors/colors.min.css?url";
// import dsfrWebManifest from "@codegouvfr/react-dsfr/favicon/manifest.webmanifest?url";
import dsfrFavicon from "@codegouvfr/react-dsfr/favicon/favicon.ico?url";
import dsfrFaviconSvg from "@codegouvfr/react-dsfr/favicon/favicon.svg?url";
import dsfrAppleTouchIcon from "@codegouvfr/react-dsfr/favicon/apple-touch-icon.png?url";

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
    { property: "apple-mobile-web-app-capable", content: "yes" },
    { property: "mobile-web-app-capable", content: "yes" },
    { property: "apple-mobile-web-app-title", content: "Zacharie" },
    { property: "apple-mobile-web-app-status-bar-style", content: "#000091" },
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

export function clientLoader(): ReturnType<LoaderFunction> {
  return {
    ENV: JSON.stringify({
      NODE_ENV: import.meta.env.MODE,
      VAPID_PUBLIC_KEY: import.meta.env.VITE_VAPID_PUBLIC_KEY as string,
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
        {/* <link rel="manifest" href={dsfrWebManifest} crossOrigin="use-credentials" /> */}
        <link rel="stylesheet" href={dsfrCss} />
        <link rel="stylesheet" href={dsfrColorCss} />
        {/* <PWAManifest /> */}
        <Meta />
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
  console.log("error from ErrorBoundary", error);
  console.log("isRouteErrorResponse(error)", isRouteErrorResponse(error));
  if (!isRouteErrorResponse(error)) {
    return <UnexpectedError />;
  }
  return <RootDisplay>{error.status === 404 ? <NotFound /> : <UnexpectedError />}</RootDisplay>;
};

export default function App() {
  const { ENV } = useLoaderData<typeof clientLoader>();

  return (
    <>
      <OfflineMode />
      <NouvelleVersion />
      <InstallApp />
      <Outlet />

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
