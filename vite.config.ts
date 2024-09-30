import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { installGlobals } from "@remix-run/node";
import { defineConfig, loadEnv } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { RemixVitePWA } from "@vite-pwa/remix";
import path from "path";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

const buildId = JSON.stringify(new Date().toISOString().split("T")[0] + "-v0");
process.env.VITE_BUILD_ID = buildId;

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isSpaMode = env.SPA_MODE === "true";

  console.log("Vite mode", mode, env.SPA_MODE);
  return {
    ssr: {
      noExternal: ["@codegouvfr/react-dsfr"],
    },
    define: {
      __VITE_BUILD_ID__: buildId,
    },
    server: {
      cors: {
        origin: ["http://localhost:3232", "http://localhost:3233", "https://zacharie.beta.gouv.fr"],
        credentials: true,
      },
    },
    plugins: [
      remix({
        presets: [RemixPWAPreset()],
        ssr: !isSpaMode,
        buildDirectory: isSpaMode ? "build-spa" : "build-api",

        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
        },
        ignoredRouteFiles: isSpaMode ? ["**/routes/api.*"] : ["**/routes/app.*"],
      }),
      tsconfigPaths(),
      sentryVitePlugin({
        org: "betagouv",
        project: "zacharie-remix",
        url: "https://sentry.incubateur.net/",
        sourcemaps: {
          filesToDeleteAfterUpload: ["./build-spa/**/*.js.map", "./build-spa/*.js.map"],
        },
      }),
      RemixVitePWAPlugin({
        strategies: "injectManifest", // This tells the plugin to use our custom Service Worker file.
        srcDir: "app",
        filename: "main-sw.ts", // next to entry-client.ts
        registerType: "autoUpdate",
        injectRegister: false,
        pwaAssets: {
          disabled: false,
          config: true,
        },
        manifest: {
          name: "Zacharie",
          short_name: "Zacharie",
          description: "La FEI simpifiée",
          background_color: "#000091",
          theme_color: "#ffffff",
          start_url: "./?mode=standalone",
          display: "fullscreen",
          lang: "fr",
        },
        injectManifest: {
          // This configuration tells the plugin to include all js, css, html, ico, png, svg, and woff2 files in the precache manifest.
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        },
        devOptions: {
          enabled: true,
          suppressWarnings: false,
          navigateFallback: "/",
          navigateFallbackAllowlist: [/^\/$/],
          type: "module",
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/api\.zacharie\.beta\.gouv\.fr\//,
              handler: "NetworkFirst",
              options: {
                cacheName: "api-cache",
                expiration: {
                  maxEntries: 100,
                  // maxAgeSeconds: 60 * 60 * 24, // 1 day
                  maxAgeSeconds: 60, // 1 minute
                },
              },
            },
          ],
        },
      }),
    ],
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 5000,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
      },
    },
  };
});
