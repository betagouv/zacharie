// vite.config.ts
import { vitePlugin as remix } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/@remix-run/dev/dist/index.js";
import { sentryVitePlugin } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { installGlobals } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/@remix-run/node/dist/index.js";
import { defineConfig, loadEnv } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/vite/dist/node/index.js";
import tsconfigPaths from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/vite-tsconfig-paths/dist/index.mjs";
import { RemixVitePWA } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/node_modules/@vite-pwa/remix/dist/index.mjs";
installGlobals();
var { RemixVitePWAPlugin, RemixPWAPreset } = RemixVitePWA();
var vite_config_default = defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const isSpaMode = env.SPA_MODE === "true";
  console.log("Vite mode", mode, env.SPA_MODE);
  return {
    ssr: {
      noExternal: ["@codegouvfr/react-dsfr"]
    },
    server: {
      cors: {
        origin: "http://localhost:3232",
        credentials: true
      }
    },
    plugins: [
      remix({
        presets: [RemixPWAPreset()],
        ssr: !isSpaMode,
        future: {
          v3_fetcherPersist: true,
          v3_relativeSplatPath: true,
          v3_throwAbortReason: true
        },
        ignoredRouteFiles: isSpaMode ? ["**/routes/action.*", "**/routes/admin.*", "**/routes/loader.*"] : ["**/.*"]
      }),
      tsconfigPaths(),
      sentryVitePlugin({
        org: "betagouv",
        project: "zacharie-remix",
        url: "https://sentry.incubateur.net/"
      })
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
      chunkSizeWarningLimit: 5e3,
      outDir: isSpaMode ? "build-spa" : "build"
    },
    resolve: {
      alias: {
        ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js"
      }
    }
  };
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYXJuYXVkYW1icm9zZWxsaS9Qcm8vMjAyNC0wOS0wNjRfQmV0YWdvdXZfWmFjaGFyaWUvemFjaGFyaWVcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9Vc2Vycy9hcm5hdWRhbWJyb3NlbGxpL1Byby8yMDI0LTA5LTA2NF9CZXRhZ291dl9aYWNoYXJpZS96YWNoYXJpZS92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vVXNlcnMvYXJuYXVkYW1icm9zZWxsaS9Qcm8vMjAyNC0wOS0wNjRfQmV0YWdvdXZfWmFjaGFyaWUvemFjaGFyaWUvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyB2aXRlUGx1Z2luIGFzIHJlbWl4IH0gZnJvbSBcIkByZW1peC1ydW4vZGV2XCI7XG5pbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSBcIkBzZW50cnkvdml0ZS1wbHVnaW5cIjtcbmltcG9ydCB7IGluc3RhbGxHbG9iYWxzIH0gZnJvbSBcIkByZW1peC1ydW4vbm9kZVwiO1xuaW1wb3J0IHsgZGVmaW5lQ29uZmlnLCBsb2FkRW52IH0gZnJvbSBcInZpdGVcIjtcbmltcG9ydCB0c2NvbmZpZ1BhdGhzIGZyb20gXCJ2aXRlLXRzY29uZmlnLXBhdGhzXCI7XG5pbXBvcnQgeyBSZW1peFZpdGVQV0EgfSBmcm9tIFwiQHZpdGUtcHdhL3JlbWl4XCI7XG5pbXBvcnQgeyBmaWxlVVJMVG9QYXRoIH0gZnJvbSBcIm5vZGU6dXJsXCI7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSBcInBhdGhcIjtcblxuaW5zdGFsbEdsb2JhbHMoKTtcblxuY29uc3QgeyBSZW1peFZpdGVQV0FQbHVnaW4sIFJlbWl4UFdBUHJlc2V0IH0gPSBSZW1peFZpdGVQV0EoKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKCh7IG1vZGUgfSkgPT4ge1xuICBjb25zdCBlbnYgPSBsb2FkRW52KG1vZGUsIHByb2Nlc3MuY3dkKCksIFwiXCIpO1xuICBjb25zdCBpc1NwYU1vZGUgPSBlbnYuU1BBX01PREUgPT09IFwidHJ1ZVwiO1xuXG4gIGNvbnNvbGUubG9nKFwiVml0ZSBtb2RlXCIsIG1vZGUsIGVudi5TUEFfTU9ERSk7XG4gIHJldHVybiB7XG4gICAgc3NyOiB7XG4gICAgICBub0V4dGVybmFsOiBbXCJAY29kZWdvdXZmci9yZWFjdC1kc2ZyXCJdLFxuICAgIH0sXG4gICAgc2VydmVyOiB7XG4gICAgICBjb3JzOiB7XG4gICAgICAgIG9yaWdpbjogXCJodHRwOi8vbG9jYWxob3N0OjMyMzJcIixcbiAgICAgICAgY3JlZGVudGlhbHM6IHRydWUsXG4gICAgICB9LFxuICAgIH0sXG4gICAgcGx1Z2luczogW1xuICAgICAgcmVtaXgoe1xuICAgICAgICBwcmVzZXRzOiBbUmVtaXhQV0FQcmVzZXQoKV0sXG4gICAgICAgIHNzcjogIWlzU3BhTW9kZSxcbiAgICAgICAgZnV0dXJlOiB7XG4gICAgICAgICAgdjNfZmV0Y2hlclBlcnNpc3Q6IHRydWUsXG4gICAgICAgICAgdjNfcmVsYXRpdmVTcGxhdFBhdGg6IHRydWUsXG4gICAgICAgICAgdjNfdGhyb3dBYm9ydFJlYXNvbjogdHJ1ZSxcbiAgICAgICAgfSxcbiAgICAgICAgaWdub3JlZFJvdXRlRmlsZXM6IGlzU3BhTW9kZSA/IFtcIioqL3JvdXRlcy9hY3Rpb24uKlwiLCBcIioqL3JvdXRlcy9hZG1pbi4qXCIsIFwiKiovcm91dGVzL2xvYWRlci4qXCJdIDogW1wiKiovLipcIl0sXG4gICAgICB9KSxcbiAgICAgIHRzY29uZmlnUGF0aHMoKSxcbiAgICAgIHNlbnRyeVZpdGVQbHVnaW4oe1xuICAgICAgICBvcmc6IFwiYmV0YWdvdXZcIixcbiAgICAgICAgcHJvamVjdDogXCJ6YWNoYXJpZS1yZW1peFwiLFxuICAgICAgICB1cmw6IFwiaHR0cHM6Ly9zZW50cnkuaW5jdWJhdGV1ci5uZXQvXCIsXG4gICAgICB9KSxcbiAgICAgIC8vIFJlbWl4Vml0ZVBXQVBsdWdpbih7XG4gICAgICAvLyAgIHN0cmF0ZWdpZXM6IFwiaW5qZWN0TWFuaWZlc3RcIixcbiAgICAgIC8vICAgc3JjRGlyOiBcImFwcFwiLFxuICAgICAgLy8gICBmaWxlbmFtZTogXCJzdy50c1wiLFxuICAgICAgLy8gICByZWdpc3RlclR5cGU6IFwiYXV0b1VwZGF0ZVwiLFxuICAgICAgLy8gICBpbmplY3RSZWdpc3RlcjogZmFsc2UsXG4gICAgICAvLyAgIHB3YUFzc2V0czoge1xuICAgICAgLy8gICAgIGRpc2FibGVkOiBmYWxzZSxcbiAgICAgIC8vICAgICBjb25maWc6IHRydWUsXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyAgIG1hbmlmZXN0OiB7XG4gICAgICAvLyAgICAgbmFtZTogXCJaYWNoYXJpZVwiLFxuICAgICAgLy8gICAgIHNob3J0X25hbWU6IFwiWmFjaGFyaWVcIixcbiAgICAgIC8vICAgICBkZXNjcmlwdGlvbjogXCJMYSBGRUkgc2ltcGlmaVx1MDBFOWVcIixcbiAgICAgIC8vICAgICBiYWNrZ3JvdW5kX2NvbG9yOiBcIiMwMDAwOTFcIixcbiAgICAgIC8vICAgICB0aGVtZV9jb2xvcjogXCIjZmZmZmZmXCIsXG4gICAgICAvLyAgICAgc3RhcnRfdXJsOiBcIi4vP21vZGU9c3RhbmRhbG9uZVwiLFxuICAgICAgLy8gICAgIGRpc3BsYXk6IFwiZnVsbHNjcmVlblwiLFxuICAgICAgLy8gICAgIGxhbmc6IFwiZnJcIixcbiAgICAgIC8vICAgfSxcbiAgICAgIC8vICAgaW5qZWN0TWFuaWZlc3Q6IHtcbiAgICAgIC8vICAgICBnbG9iUGF0dGVybnM6IFtcIioqLyoue2pzLGh0bWwsY3NzLHBuZyxzdmcsaWNvfVwiXSxcbiAgICAgIC8vICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogMTAgKiAxMDI0ICogMTAyNCxcbiAgICAgIC8vICAgfSxcbiAgICAgIC8vICAgZGV2T3B0aW9uczoge1xuICAgICAgLy8gICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAvLyAgICAgc3VwcHJlc3NXYXJuaW5nczogZmFsc2UsXG4gICAgICAvLyAgICAgbmF2aWdhdGVGYWxsYmFjazogXCIvXCIsXG4gICAgICAvLyAgICAgbmF2aWdhdGVGYWxsYmFja0FsbG93bGlzdDogWy9eXFwvJC9dLFxuICAgICAgLy8gICAgIHR5cGU6IFwibW9kdWxlXCIsXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyAgIHdvcmtib3g6IHtcbiAgICAgIC8vICAgICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgLy8gICAgICAge1xuICAgICAgLy8gICAgICAgICB1cmxQYXR0ZXJuOiAvXmh0dHBzOlxcL1xcL3lvdXItYXBpLWRvbWFpblxcLmNvbVxcLy8sXG4gICAgICAvLyAgICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya0ZpcnN0XCIsXG4gICAgICAvLyAgICAgICAgIG9wdGlvbnM6IHtcbiAgICAgIC8vICAgICAgICAgICBjYWNoZU5hbWU6IFwiYXBpLWNhY2hlXCIsXG4gICAgICAvLyAgICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgLy8gICAgICAgICAgICAgbWF4RW50cmllczogMTAwLFxuICAgICAgLy8gICAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAgKiA2MCAqIDI0LCAvLyAxIGRheVxuICAgICAgLy8gICAgICAgICAgIH0sXG4gICAgICAvLyAgICAgICAgIH0sXG4gICAgICAvLyAgICAgICB9LFxuICAgICAgLy8gICAgIF0sXG4gICAgICAvLyAgIH0sXG4gICAgICAvLyB9KSxcbiAgICBdLFxuICAgIGJ1aWxkOiB7XG4gICAgICBzb3VyY2VtYXA6IHRydWUsXG4gICAgICBjaHVua1NpemVXYXJuaW5nTGltaXQ6IDUwMDAsXG4gICAgICBvdXREaXI6IGlzU3BhTW9kZSA/IFwiYnVpbGQtc3BhXCIgOiBcImJ1aWxkXCIsXG4gICAgfSxcbiAgICByZXNvbHZlOiB7XG4gICAgICBhbGlhczoge1xuICAgICAgICBcIi5wcmlzbWEvY2xpZW50L2luZGV4LWJyb3dzZXJcIjogXCIuL25vZGVfbW9kdWxlcy8ucHJpc21hL2NsaWVudC9pbmRleC1icm93c2VyLmpzXCIsXG4gICAgICB9LFxuICAgIH0sXG4gIH07XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBd1gsU0FBUyxjQUFjLGFBQWE7QUFDNVosU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxjQUFjLGVBQWU7QUFDdEMsT0FBTyxtQkFBbUI7QUFDMUIsU0FBUyxvQkFBb0I7QUFJN0IsZUFBZTtBQUVmLElBQU0sRUFBRSxvQkFBb0IsZUFBZSxJQUFJLGFBQWE7QUFFNUQsSUFBTyxzQkFBUSxhQUFhLENBQUMsRUFBRSxLQUFLLE1BQU07QUFDeEMsUUFBTSxNQUFNLFFBQVEsTUFBTSxRQUFRLElBQUksR0FBRyxFQUFFO0FBQzNDLFFBQU0sWUFBWSxJQUFJLGFBQWE7QUFFbkMsVUFBUSxJQUFJLGFBQWEsTUFBTSxJQUFJLFFBQVE7QUFDM0MsU0FBTztBQUFBLElBQ0wsS0FBSztBQUFBLE1BQ0gsWUFBWSxDQUFDLHdCQUF3QjtBQUFBLElBQ3ZDO0FBQUEsSUFDQSxRQUFRO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDSixRQUFRO0FBQUEsUUFDUixhQUFhO0FBQUEsTUFDZjtBQUFBLElBQ0Y7QUFBQSxJQUNBLFNBQVM7QUFBQSxNQUNQLE1BQU07QUFBQSxRQUNKLFNBQVMsQ0FBQyxlQUFlLENBQUM7QUFBQSxRQUMxQixLQUFLLENBQUM7QUFBQSxRQUNOLFFBQVE7QUFBQSxVQUNOLG1CQUFtQjtBQUFBLFVBQ25CLHNCQUFzQjtBQUFBLFVBQ3RCLHFCQUFxQjtBQUFBLFFBQ3ZCO0FBQUEsUUFDQSxtQkFBbUIsWUFBWSxDQUFDLHNCQUFzQixxQkFBcUIsb0JBQW9CLElBQUksQ0FBQyxPQUFPO0FBQUEsTUFDN0csQ0FBQztBQUFBLE1BQ0QsY0FBYztBQUFBLE1BQ2QsaUJBQWlCO0FBQUEsUUFDZixLQUFLO0FBQUEsUUFDTCxTQUFTO0FBQUEsUUFDVCxLQUFLO0FBQUEsTUFDUCxDQUFDO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLElBZ0RIO0FBQUEsSUFDQSxPQUFPO0FBQUEsTUFDTCxXQUFXO0FBQUEsTUFDWCx1QkFBdUI7QUFBQSxNQUN2QixRQUFRLFlBQVksY0FBYztBQUFBLElBQ3BDO0FBQUEsSUFDQSxTQUFTO0FBQUEsTUFDUCxPQUFPO0FBQUEsUUFDTCxnQ0FBZ0M7QUFBQSxNQUNsQztBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
