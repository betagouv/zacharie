import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { resolve } from 'path';
import dayjs from 'dayjs';
import { VitePWA } from 'vite-plugin-pwa';

const buildId = JSON.stringify(`${dayjs().format('DD-MM-YYYY')} vers ${dayjs().format('HH')}:00`);
process.env.VITE_BUILD_ID = buildId;

// https://vitejs.dev/config/
export default defineConfig({
  base: '/',
  optimizeDeps: {
    // noDiscovery: true,
    include: ['@prisma/client'],
  },
  plugins: [
    react(),
    sentryVitePlugin({
      org: 'betagouv',
      project: 'zacharie-vite-react-router-spa',
      telemetry: false,
      disable: !process.env.CI,
    }),
    !process.env.VITEST ? checker({ typescript: true }) : undefined,
    VitePWA({
      strategies: 'injectManifest', // This tells the plugin to use our custom Service Worker file.
      srcDir: 'src',
      filename: 'service-worker.ts', // next to entry-client.ts
      registerType: 'autoUpdate',
      injectRegister: false,
      pwaAssets: {
        disabled: true,
      },
      manifest: {
        name: 'Zacharie',
        short_name: 'Zacharie',
        id: './?mode=standalone',
        start_url: './?mode=standalone',
        display: 'fullscreen',
        display_override: ['standalone', 'fullscreen', 'browser'],
        background_color: '#000091',
        lang: 'fr',
        scope: '/',
        description: 'Garantir des viandes de gibier sauvage saines et sûres',
        theme_color: '#ffffff',
        icons: [
          {
            src: '/pwa-assets/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-assets/manifest-icon-192.maskable.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable',
          },
          {
            src: '/pwa-assets/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-assets/manifest-icon-512.maskable.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      injectManifest: {
        // This configuration tells the plugin to include all js, css, html, ico, png, svg, and woff2 files in the precache manifest.
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        maximumFileSizeToCacheInBytes: 100 * 1024 * 1024,
        // injectionPoint: undefined,
        // rollupFormat: "es",
        // swDest: "build-spa/client/main-sw.js",
        // swSrc: "build-spa/client/main-sw.mjs",
      },
      devOptions: {
        enabled: true,
        suppressWarnings: false,
        navigateFallback: '/',
        navigateFallbackAllowlist: [/^\/$/],
        type: 'module',
      },
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
  ],
  build: {
    outDir: 'build',
    sourcemap: true,
  },
  resolve: {
    alias: {
      '.prisma/client/index-browser': './node_modules/.prisma/client/index-browser.js',
      '@app': '/src',
      '@api': resolve(__dirname, '../api-express'),
      '~': resolve(__dirname, '../api-express'),
    },
  },
  define: {
    __VITE_BUILD_ID__: buildId,
    'process.env': process.env,
  },
});
