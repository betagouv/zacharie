// vite.config.ts
import { sentryVitePlugin } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/@sentry/vite-plugin/dist/esm/index.mjs";
import { defineConfig } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/vite/dist/node/index.js";
import react from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/@vitejs/plugin-react-swc/index.mjs";
import checker from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/vite-plugin-checker/dist/esm/main.js";
import { resolve } from "path";
import dayjs from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/dayjs/dayjs.min.js";
import { VitePWA } from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/vite-plugin-pwa/dist/index.js";
import tailwindcss from "file:///Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router/node_modules/@tailwindcss/vite/dist/index.mjs";
var __vite_injected_original_dirname = "/Users/arnaudambroselli/Pro/2024-09-064_Betagouv_Zacharie/zacharie/app-local-first-react-router";
var buildId = JSON.stringify(`${dayjs().format("DD-MM-YYYY")} vers ${dayjs().format("HH")}:00`);
process.env.VITE_BUILD_ID = buildId;
var vite_config_default = defineConfig({
  base: "/",
  optimizeDeps: {
    // noDiscovery: true,
    include: ["@prisma/client"]
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: "betagouv",
      project: "zacharie-vite-react-router-spa",
      telemetry: false,
      disable: !process.env.CI
    }),
    !process.env.VITEST ? checker({ typescript: true }) : void 0,
    VitePWA({
      strategies: "injectManifest",
      // This tells the plugin to use our custom Service Worker file.
      srcDir: "src",
      filename: "service-worker.ts",
      // next to entry-client.ts
      registerType: "autoUpdate",
      injectRegister: false,
      pwaAssets: {
        disabled: true
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
        description: "Garantir des viandes de gibier sauvage saines et s\xFBres",
        theme_color: "#ffffff",
        icons: [
          {
            src: "/pwa-assets/manifest-icon-192.maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-assets/manifest-icon-192.maskable.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "/pwa-assets/manifest-icon-512.maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "/pwa-assets/manifest-icon-512.maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      injectManifest: {
        // This configuration tells the plugin to include all js, css, html, ico, png, svg, and woff2 files in the precache manifest.
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024
        // injectionPoint: undefined,
        // rollupFormat: "es",
        // swDest: "build-spa/client/main-sw.js",
        // swSrc: "build-spa/client/main-sw.mjs",
      },
      devOptions: {
        enabled: true,
        suppressWarnings: false,
        navigateFallback: "/",
        navigateFallbackAllowlist: [/^\/$/],
        type: "module"
      }
      // workbox: {
      //   globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
      //   runtimeCaching: [
      //     {
      //       urlPattern: /^https:\/\/api\.zacharie\.beta\.gouv\.fr\//,
      //       handler: "NetworkFirst",
      //       options: {
      //         cacheName: "api-v2-cache",
      //         expiration: {
      //           maxEntries: 100,
      //           // maxAgeSeconds: 60 * 60 * 24, // 1 day
      //           maxAgeSeconds: 60, // 1 minute
      //         },
      //       },
      //     },
      //   ],
      // },
    }),
    tailwindcss()
  ],
  build: {
    outDir: "build",
    sourcemap: true
  },
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
      "@app": "/src",
      "@api": resolve(__vite_injected_original_dirname, "../api-express"),
      "~": resolve(__vite_injected_original_dirname, "../api-express")
    }
  },
  define: {
    __VITE_BUILD_ID__: buildId,
    "process.env": process.env
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvVXNlcnMvYXJuYXVkYW1icm9zZWxsaS9Qcm8vMjAyNC0wOS0wNjRfQmV0YWdvdXZfWmFjaGFyaWUvemFjaGFyaWUvYXBwLWxvY2FsLWZpcnN0LXJlYWN0LXJvdXRlclwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiL1VzZXJzL2FybmF1ZGFtYnJvc2VsbGkvUHJvLzIwMjQtMDktMDY0X0JldGFnb3V2X1phY2hhcmllL3phY2hhcmllL2FwcC1sb2NhbC1maXJzdC1yZWFjdC1yb3V0ZXIvdml0ZS5jb25maWcudHNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL1VzZXJzL2FybmF1ZGFtYnJvc2VsbGkvUHJvLzIwMjQtMDktMDY0X0JldGFnb3V2X1phY2hhcmllL3phY2hhcmllL2FwcC1sb2NhbC1maXJzdC1yZWFjdC1yb3V0ZXIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBzZW50cnlWaXRlUGx1Z2luIH0gZnJvbSAnQHNlbnRyeS92aXRlLXBsdWdpbic7XG5pbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJztcbmltcG9ydCByZWFjdCBmcm9tICdAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2MnO1xuaW1wb3J0IGNoZWNrZXIgZnJvbSAndml0ZS1wbHVnaW4tY2hlY2tlcic7XG5pbXBvcnQgeyByZXNvbHZlIH0gZnJvbSAncGF0aCc7XG5pbXBvcnQgZGF5anMgZnJvbSAnZGF5anMnO1xuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XG5pbXBvcnQgdGFpbHdpbmRjc3MgZnJvbSAnQHRhaWx3aW5kY3NzL3ZpdGUnO1xuXG5jb25zdCBidWlsZElkID0gSlNPTi5zdHJpbmdpZnkoYCR7ZGF5anMoKS5mb3JtYXQoJ0RELU1NLVlZWVknKX0gdmVycyAke2RheWpzKCkuZm9ybWF0KCdISCcpfTowMGApO1xucHJvY2Vzcy5lbnYuVklURV9CVUlMRF9JRCA9IGJ1aWxkSWQ7XG5cbi8vIGh0dHBzOi8vdml0ZWpzLmRldi9jb25maWcvXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBiYXNlOiAnLycsXG4gIG9wdGltaXplRGVwczoge1xuICAgIC8vIG5vRGlzY292ZXJ5OiB0cnVlLFxuICAgIGluY2x1ZGU6IFsnQHByaXNtYS9jbGllbnQnXSxcbiAgfSxcbiAgcGx1Z2luczogW1xuICAgIHJlYWN0KCksXG4gICAgc2VudHJ5Vml0ZVBsdWdpbih7XG4gICAgICBvcmc6ICdiZXRhZ291dicsXG4gICAgICBwcm9qZWN0OiAnemFjaGFyaWUtdml0ZS1yZWFjdC1yb3V0ZXItc3BhJyxcbiAgICAgIHRlbGVtZXRyeTogZmFsc2UsXG4gICAgICBkaXNhYmxlOiAhcHJvY2Vzcy5lbnYuQ0ksXG4gICAgfSksXG4gICAgIXByb2Nlc3MuZW52LlZJVEVTVCA/IGNoZWNrZXIoeyB0eXBlc2NyaXB0OiB0cnVlIH0pIDogdW5kZWZpbmVkLFxuICAgIFZpdGVQV0Eoe1xuICAgICAgc3RyYXRlZ2llczogJ2luamVjdE1hbmlmZXN0JywgLy8gVGhpcyB0ZWxscyB0aGUgcGx1Z2luIHRvIHVzZSBvdXIgY3VzdG9tIFNlcnZpY2UgV29ya2VyIGZpbGUuXG4gICAgICBzcmNEaXI6ICdzcmMnLFxuICAgICAgZmlsZW5hbWU6ICdzZXJ2aWNlLXdvcmtlci50cycsIC8vIG5leHQgdG8gZW50cnktY2xpZW50LnRzXG4gICAgICByZWdpc3RlclR5cGU6ICdhdXRvVXBkYXRlJyxcbiAgICAgIGluamVjdFJlZ2lzdGVyOiBmYWxzZSxcbiAgICAgIHB3YUFzc2V0czoge1xuICAgICAgICBkaXNhYmxlZDogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBtYW5pZmVzdDoge1xuICAgICAgICBuYW1lOiAnWmFjaGFyaWUnLFxuICAgICAgICBzaG9ydF9uYW1lOiAnWmFjaGFyaWUnLFxuICAgICAgICBpZDogJy4vP21vZGU9c3RhbmRhbG9uZScsXG4gICAgICAgIHN0YXJ0X3VybDogJy4vP21vZGU9c3RhbmRhbG9uZScsXG4gICAgICAgIGRpc3BsYXk6ICdmdWxsc2NyZWVuJyxcbiAgICAgICAgZGlzcGxheV9vdmVycmlkZTogWydzdGFuZGFsb25lJywgJ2Z1bGxzY3JlZW4nLCAnYnJvd3NlciddLFxuICAgICAgICBiYWNrZ3JvdW5kX2NvbG9yOiAnIzAwMDA5MScsXG4gICAgICAgIGxhbmc6ICdmcicsXG4gICAgICAgIHNjb3BlOiAnLycsXG4gICAgICAgIGRlc2NyaXB0aW9uOiAnR2FyYW50aXIgZGVzIHZpYW5kZXMgZGUgZ2liaWVyIHNhdXZhZ2Ugc2FpbmVzIGV0IHNcdTAwRkJyZXMnLFxuICAgICAgICB0aGVtZV9jb2xvcjogJyNmZmZmZmYnLFxuICAgICAgICBpY29uczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJy9wd2EtYXNzZXRzL21hbmlmZXN0LWljb24tMTkyLm1hc2thYmxlLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnYW55JyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHNyYzogJy9wd2EtYXNzZXRzL21hbmlmZXN0LWljb24tMTkyLm1hc2thYmxlLnBuZycsXG4gICAgICAgICAgICBzaXplczogJzE5MngxOTInLFxuICAgICAgICAgICAgdHlwZTogJ2ltYWdlL3BuZycsXG4gICAgICAgICAgICBwdXJwb3NlOiAnbWFza2FibGUnLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL3B3YS1hc3NldHMvbWFuaWZlc3QtaWNvbi01MTIubWFza2FibGUucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgIHB1cnBvc2U6ICdhbnknLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgc3JjOiAnL3B3YS1hc3NldHMvbWFuaWZlc3QtaWNvbi01MTIubWFza2FibGUucG5nJyxcbiAgICAgICAgICAgIHNpemVzOiAnNTEyeDUxMicsXG4gICAgICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJyxcbiAgICAgICAgICAgIHB1cnBvc2U6ICdtYXNrYWJsZScsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgICBpbmplY3RNYW5pZmVzdDoge1xuICAgICAgICAvLyBUaGlzIGNvbmZpZ3VyYXRpb24gdGVsbHMgdGhlIHBsdWdpbiB0byBpbmNsdWRlIGFsbCBqcywgY3NzLCBodG1sLCBpY28sIHBuZywgc3ZnLCBhbmQgd29mZjIgZmlsZXMgaW4gdGhlIHByZWNhY2hlIG1hbmlmZXN0LlxuICAgICAgICBnbG9iUGF0dGVybnM6IFsnKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9J10sXG4gICAgICAgIG1heGltdW1GaWxlU2l6ZVRvQ2FjaGVJbkJ5dGVzOiAxMDAgKiAxMDI0ICogMTAyNCxcbiAgICAgICAgLy8gaW5qZWN0aW9uUG9pbnQ6IHVuZGVmaW5lZCxcbiAgICAgICAgLy8gcm9sbHVwRm9ybWF0OiBcImVzXCIsXG4gICAgICAgIC8vIHN3RGVzdDogXCJidWlsZC1zcGEvY2xpZW50L21haW4tc3cuanNcIixcbiAgICAgICAgLy8gc3dTcmM6IFwiYnVpbGQtc3BhL2NsaWVudC9tYWluLXN3Lm1qc1wiLFxuICAgICAgfSxcbiAgICAgIGRldk9wdGlvbnM6IHtcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgc3VwcHJlc3NXYXJuaW5nczogZmFsc2UsXG4gICAgICAgIG5hdmlnYXRlRmFsbGJhY2s6ICcvJyxcbiAgICAgICAgbmF2aWdhdGVGYWxsYmFja0FsbG93bGlzdDogWy9eXFwvJC9dLFxuICAgICAgICB0eXBlOiAnbW9kdWxlJyxcbiAgICAgIH0sXG4gICAgICAvLyB3b3JrYm94OiB7XG4gICAgICAvLyAgIGdsb2JQYXR0ZXJuczogW1wiKiovKi57anMsY3NzLGh0bWwsaWNvLHBuZyxzdmcsd29mZjJ9XCJdLFxuICAgICAgLy8gICBydW50aW1lQ2FjaGluZzogW1xuICAgICAgLy8gICAgIHtcbiAgICAgIC8vICAgICAgIHVybFBhdHRlcm46IC9eaHR0cHM6XFwvXFwvYXBpXFwuemFjaGFyaWVcXC5iZXRhXFwuZ291dlxcLmZyXFwvLyxcbiAgICAgIC8vICAgICAgIGhhbmRsZXI6IFwiTmV0d29ya0ZpcnN0XCIsXG4gICAgICAvLyAgICAgICBvcHRpb25zOiB7XG4gICAgICAvLyAgICAgICAgIGNhY2hlTmFtZTogXCJhcGktdjItY2FjaGVcIixcbiAgICAgIC8vICAgICAgICAgZXhwaXJhdGlvbjoge1xuICAgICAgLy8gICAgICAgICAgIG1heEVudHJpZXM6IDEwMCxcbiAgICAgIC8vICAgICAgICAgICAvLyBtYXhBZ2VTZWNvbmRzOiA2MCAqIDYwICogMjQsIC8vIDEgZGF5XG4gICAgICAvLyAgICAgICAgICAgbWF4QWdlU2Vjb25kczogNjAsIC8vIDEgbWludXRlXG4gICAgICAvLyAgICAgICAgIH0sXG4gICAgICAvLyAgICAgICB9LFxuICAgICAgLy8gICAgIH0sXG4gICAgICAvLyAgIF0sXG4gICAgICAvLyB9LFxuICAgIH0pLFxuICAgIHRhaWx3aW5kY3NzKCksXG4gIF0sXG4gIGJ1aWxkOiB7XG4gICAgb3V0RGlyOiAnYnVpbGQnLFxuICAgIHNvdXJjZW1hcDogdHJ1ZSxcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnLnByaXNtYS9jbGllbnQvaW5kZXgtYnJvd3Nlcic6ICcuL25vZGVfbW9kdWxlcy8ucHJpc21hL2NsaWVudC9pbmRleC1icm93c2VyLmpzJyxcbiAgICAgICdAYXBwJzogJy9zcmMnLFxuICAgICAgJ0BhcGknOiByZXNvbHZlKF9fZGlybmFtZSwgJy4uL2FwaS1leHByZXNzJyksXG4gICAgICAnfic6IHJlc29sdmUoX19kaXJuYW1lLCAnLi4vYXBpLWV4cHJlc3MnKSxcbiAgICB9LFxuICB9LFxuICBkZWZpbmU6IHtcbiAgICBfX1ZJVEVfQlVJTERfSURfXzogYnVpbGRJZCxcbiAgICAncHJvY2Vzcy5lbnYnOiBwcm9jZXNzLmVudixcbiAgfSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUErYyxTQUFTLHdCQUF3QjtBQUNoZixTQUFTLG9CQUFvQjtBQUM3QixPQUFPLFdBQVc7QUFDbEIsT0FBTyxhQUFhO0FBQ3BCLFNBQVMsZUFBZTtBQUN4QixPQUFPLFdBQVc7QUFDbEIsU0FBUyxlQUFlO0FBQ3hCLE9BQU8saUJBQWlCO0FBUHhCLElBQU0sbUNBQW1DO0FBU3pDLElBQU0sVUFBVSxLQUFLLFVBQVUsR0FBRyxNQUFNLEVBQUUsT0FBTyxZQUFZLENBQUMsU0FBUyxNQUFNLEVBQUUsT0FBTyxJQUFJLENBQUMsS0FBSztBQUNoRyxRQUFRLElBQUksZ0JBQWdCO0FBRzVCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLE1BQU07QUFBQSxFQUNOLGNBQWM7QUFBQTtBQUFBLElBRVosU0FBUyxDQUFDLGdCQUFnQjtBQUFBLEVBQzVCO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUEsSUFDTixpQkFBaUI7QUFBQSxNQUNmLEtBQUs7QUFBQSxNQUNMLFNBQVM7QUFBQSxNQUNULFdBQVc7QUFBQSxNQUNYLFNBQVMsQ0FBQyxRQUFRLElBQUk7QUFBQSxJQUN4QixDQUFDO0FBQUEsSUFDRCxDQUFDLFFBQVEsSUFBSSxTQUFTLFFBQVEsRUFBRSxZQUFZLEtBQUssQ0FBQyxJQUFJO0FBQUEsSUFDdEQsUUFBUTtBQUFBLE1BQ04sWUFBWTtBQUFBO0FBQUEsTUFDWixRQUFRO0FBQUEsTUFDUixVQUFVO0FBQUE7QUFBQSxNQUNWLGNBQWM7QUFBQSxNQUNkLGdCQUFnQjtBQUFBLE1BQ2hCLFdBQVc7QUFBQSxRQUNULFVBQVU7QUFBQSxNQUNaO0FBQUEsTUFDQSxVQUFVO0FBQUEsUUFDUixNQUFNO0FBQUEsUUFDTixZQUFZO0FBQUEsUUFDWixJQUFJO0FBQUEsUUFDSixXQUFXO0FBQUEsUUFDWCxTQUFTO0FBQUEsUUFDVCxrQkFBa0IsQ0FBQyxjQUFjLGNBQWMsU0FBUztBQUFBLFFBQ3hELGtCQUFrQjtBQUFBLFFBQ2xCLE1BQU07QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLGFBQWE7QUFBQSxRQUNiLGFBQWE7QUFBQSxRQUNiLE9BQU87QUFBQSxVQUNMO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFVBQ0E7QUFBQSxZQUNFLEtBQUs7QUFBQSxZQUNMLE9BQU87QUFBQSxZQUNQLE1BQU07QUFBQSxZQUNOLFNBQVM7QUFBQSxVQUNYO0FBQUEsVUFDQTtBQUFBLFlBQ0UsS0FBSztBQUFBLFlBQ0wsT0FBTztBQUFBLFlBQ1AsTUFBTTtBQUFBLFlBQ04sU0FBUztBQUFBLFVBQ1g7QUFBQSxVQUNBO0FBQUEsWUFDRSxLQUFLO0FBQUEsWUFDTCxPQUFPO0FBQUEsWUFDUCxNQUFNO0FBQUEsWUFDTixTQUFTO0FBQUEsVUFDWDtBQUFBLFFBQ0Y7QUFBQSxNQUNGO0FBQUEsTUFDQSxnQkFBZ0I7QUFBQTtBQUFBLFFBRWQsY0FBYyxDQUFDLHNDQUFzQztBQUFBLFFBQ3JELCtCQUErQixNQUFNLE9BQU87QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLE1BSzlDO0FBQUEsTUFDQSxZQUFZO0FBQUEsUUFDVixTQUFTO0FBQUEsUUFDVCxrQkFBa0I7QUFBQSxRQUNsQixrQkFBa0I7QUFBQSxRQUNsQiwyQkFBMkIsQ0FBQyxNQUFNO0FBQUEsUUFDbEMsTUFBTTtBQUFBLE1BQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFrQkYsQ0FBQztBQUFBLElBQ0QsWUFBWTtBQUFBLEVBQ2Q7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxFQUNiO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxnQ0FBZ0M7QUFBQSxNQUNoQyxRQUFRO0FBQUEsTUFDUixRQUFRLFFBQVEsa0NBQVcsZ0JBQWdCO0FBQUEsTUFDM0MsS0FBSyxRQUFRLGtDQUFXLGdCQUFnQjtBQUFBLElBQzFDO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sbUJBQW1CO0FBQUEsSUFDbkIsZUFBZSxRQUFRO0FBQUEsRUFDekI7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
