import { sentryVitePlugin } from "@sentry/vite-plugin";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { remixPWA } from "@remix-pwa/dev";

export default defineConfig({
  ssr: {
    noExternal: ["@codegouvfr/react-dsfr"],
  },

  plugins: [
    remix({
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
      },
    }),
    tsconfigPaths(),
    sentryVitePlugin({
      org: "betagouv",
      project: "zacharie-remix",
      url: "https://sentry.incubateur.net/",
    }),
    remixPWA(),
  ],
  build: {
    sourcemap: true,
  },
});
