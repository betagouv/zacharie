import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { RemixVitePWA } from "@vite-pwa/remix";
import dayjs from "dayjs";
import { resolve } from "path";

installGlobals();

const { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();

const buildId = JSON.stringify(`${dayjs().format("DD-MM-YYYY")} vers ${dayjs().format("HH")}:00`);
process.env.VITE_BUILD_ID = buildId;

export default defineConfig(({ mode }) => {
  return {
    ssr: {
      noExternal: ["@codegouvfr/react-dsfr"],
    },
    // optimizeDeps: {
    //   noDiscovery: true,
    // },
    define: {
      __VITE_BUILD_ID__: buildId,
      "process.env": process.env,
    },
    server: {
      cors: {
        origin: ["http://localhost:3232", "http://localhost:3233", "https://zacharie.beta.gouv.fr"],
        credentials: true,
      },
      fs: {
        allow: ["."], // This allows serving files from project root
      },
    },
    plugins: [
      remix({
        presets: [RemixPWAPreset()],
        ssr: false,
        buildDirectory: "build-spa",

        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true,
          unstable_optimizeDeps: true,
        },
      }),
      // sentryVitePlugin({
      //   org: "betagouv",
      //   project: "zacharie-remix",
      //   url: "https://sentry.incubateur.net/",
      //   release: {
      //     name: buildId,
      //   },
      //   disable: mode === "development",
      //   sourcemaps: {
      //     filesToDeleteAfterUpload: ["./build-spa/**/*.js.map", "./build-spa/*.mjs.map"],
      //   },
      // }),
      tsconfigPaths(),
      RemixVitePWAPlugin({
        strategies: "injectManifest", // This tells the plugin to use our custom Service Worker file.
        srcDir: "app",
        filename: "main-sw.ts", // next to entry-client.ts
        registerType: "autoUpdate",
        injectRegister: false,
        pwaAssets: {
          disabled: true,
        },
        manifest: {
          name: "Zacharie",
          short_name: "Zacharie",
          id: "./?mode=standalone",
          start_url: "./?mode=standalone",
          display: "fullscreen",
          display_override: ["standalone", "fullscreen", "browser"],
          background_color: "#000091",
          lang: "fr",
          scope: "/",
          description: "Garantir des viandes de gibier sauvage saines et sûres",
          theme_color: "#ffffff",
          icons: [
            {
              src: "/pwa-assets/manifest-icon-192.maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-assets/manifest-icon-192.maskable.png",
              sizes: "192x192",
              type: "image/png",
              purpose: "maskable",
            },
            {
              src: "/pwa-assets/manifest-icon-512.maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any",
            },
            {
              src: "/pwa-assets/manifest-icon-512.maskable.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "maskable",
            },
          ],
        },
        injectManifest: {
          // This configuration tells the plugin to include all js, css, html, ico, png, svg, and woff2 files in the precache manifest.
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
          // injectionPoint: undefined,
          rollupFormat: "es",
          swDest: "build-spa/client/main-sw.js",
          swSrc: "build-spa/client/main-sw.mjs",
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
      {
        name: "configure-server",
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            res.setHeader("Service-Worker-Allowed", "/");
            next();
          });
        },
      },
    ],
    build: {
      sourcemap: true,
      chunkSizeWarningLimit: 100000,
      emptyOutDir: true,
    },
    resolve: {
      alias: {
        ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
        "@app": "/app",
        "@api": resolve(__dirname, "../api-remix/app"),
        "~": resolve(__dirname, "../api-remix/app"),
      },
    },
    worker: {
      format: "es",
    },
  };
});
