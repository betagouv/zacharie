import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { installGlobals } from "@remix-run/node";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { RemixVitePWA } from "@vite-pwa/remix";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  console.log("Vite mode", mode, env.SPA_MODE);
  return {
    ssr: {
      noExternal: ["@codegouvfr/react-dsfr"],
    },
    plugins: [
      remix({
        presets: [RemixPWAPreset()],
        ssr: env.SPA_MODE ? false : true,
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
      // RemixVitePWAPlugin({
      //   strategies: "injectManifest",
      //   srcDir: "app",
      //   filename: "sw.ts",
      //   registerType: "autoUpdate",
      //   injectRegister: false,
      //   pwaAssets: {
      //     disabled: false,
      //     config: true,
      //   },
      //   manifest: {
      //     name: "Zacharie",
      //     short_name: "Zacharie",
      //     description: "La FEI simpifiée",
      //     background_color: "#000091",
      //     theme_color: "#ffffff",
      //     start_url: "./?mode=standalone",
      //     display: "fullscreen",
      //     lang: "fr",
      //   },
      //   injectManifest: {
      //     globPatterns: ["**/*.{js,html,css,png,svg,ico}"],
      //     maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      //   },
      //   devOptions: {
      //     enabled: true,
      //     suppressWarnings: false,
      //     navigateFallback: "/",
      //     navigateFallbackAllowlist: [/^\/$/],
      //     type: "module",
      //   },
      //   workbox: {
      //     runtimeCaching: [
      //       {
      //         urlPattern: /^https:\/\/your-api-domain\.com\//,
      //         handler: "NetworkFirst",
      //         options: {
      //           cacheName: "api-cache",
      //           expiration: {
      //             maxEntries: 100,
      //             maxAgeSeconds: 60 * 60 * 24, // 1 day
      //           },
      //         },
      //       },
      //     ],
      //   },
      // }),
    ],
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 5000,
    },
    // https://github.com/prisma/prisma/issues/12504#issuecomment-1285883083
    resolve: {
      alias: {
        ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
      },
    },
  };
});
