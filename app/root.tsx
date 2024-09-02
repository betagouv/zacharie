import { Links, Meta, Outlet, Scripts, ScrollRestoration } from "@remix-run/react";
import { useNetworkConnectivity, usePWAManager } from "@remix-pwa/client";
import { useSWEffect, sendSkipWaitingMessage } from "@remix-pwa/sw";

import "./tailwind.css";

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
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

export function HydrateFallback() {
  return <p>Chargement...</p>;
}
