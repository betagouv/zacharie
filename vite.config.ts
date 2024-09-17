import { sentryVitePlugin } from "@sentry/vite-plugin";
import { vitePlugin as remix } from "@remix-run/dev";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { installGlobals } from "@remix-run/node";
import { RemixVitePWA } from "@vite-pwa/remix";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();
process.env.VITE_BUILD_DATE = JSON.stringify(new Date().toISOString());

export default defineConfig({
  ssr: {
    noExternal: ["@codegouvfr/react-dsfr"],
  },
  define: {
    VITE_BUILD_DATE: process.env.VITE_BUILD_DATE,
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
    RemixVitePWAPlugin({
      srcDir: "app",
      strategies: "injectManifest",
      filename: "enty.ts",
      base: "/",
      registerType: "autoUpdate",
      injectRegister: false,
      manifest: {
        short_name: "Zacharie",
        name: "Zacharie | Ministère de l'Agriculture",
        display: "fullscreen",
        background_color: "#000091",
        theme_color: "#ffffff",
        start_url: "./?mode=standalone",
        scope: "./",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globPatterns: ["**/*.{js,html,css,png,svg,ico}"],
      },
      injectManifest: {
        globPatterns: ["**/*.{js,html,css,png,svg,ico}"],
        // for testing purposes only
        minify: false,
        // for testing purposes only
        enableWorkboxModulesLogs: true,
      },
      devOptions: {
        enabled: true,
        type: "module",
        suppressWarnings: true,
      },
      pwaAssets: {
        config: true,
      },
    }),
    sentryVitePlugin({
      org: "betagouv",
      project: "zacharie-remix",
      url: "https://sentry.incubateur.net/",
    }),
  ],
  build: {
    sourcemap: true,
    chunkSizeWarningLimit: 800,
  },
  // https://github.com/prisma/prisma/issues/12504#issuecomment-1285883083
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
    },
  },
});
