import { sentryVitePlugin } from "@sentry/vite-plugin";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { installGlobals } from "@remix-run/node";
import { RemixVitePWA } from "@vite-pwa/remix";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

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
      presets: [RemixPWAPreset()],
    }),
    tsconfigPaths(),
    sentryVitePlugin({
      org: "betagouv",
      project: "zacharie-remix",
      url: "https://sentry.incubateur.net/",
    }),
    RemixVitePWAPlugin({
      registerType: "autoUpdate",
      devOptions: {
        enabled: true,
      },
      // PWA options
    }),
  ],
  build: {
    sourcemap: true,
  },
  // https://github.com/prisma/prisma/issues/12504#issuecomment-1285883083
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
});
