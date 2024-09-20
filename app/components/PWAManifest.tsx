import { pwaInfo } from "virtual:pwa-info";

export function PWAManifest() {
  return (
    <>
      {pwaInfo ? (
        <link
          rel="manifest"
          href={pwaInfo.webManifest.href}
          type="application/manifest+json"
          crossOrigin={pwaInfo.webManifest.useCredentials ? "use-credentials" : undefined}
        />
      ) : null}
    </>
  );
}
