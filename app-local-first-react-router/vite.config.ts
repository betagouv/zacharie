import { sentryVitePlugin } from '@sentry/vite-plugin';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react-swc';
import checker from 'vite-plugin-checker';
import { resolve } from 'path';
import dayjs from 'dayjs';
import { VitePWA } from 'vite-plugin-pwa';
import tailwindcss from '@tailwindcss/vite';
import fs from 'node:fs';
import path from 'node:path';

function spaManifestPlugin(): Plugin {
  return {
    name: 'spa-manifest-plugin',
    closeBundle: async () => {
      const buildDir = path.resolve(__dirname, 'build');
      
      if (!fs.existsSync(buildDir)) {
        console.warn('⚠️ Build directory not found, skipping spa-manifest.json generation');
        return;
      }

      const files: string[] = [];

      function scan(dir: string, baseDir: string) {
        if (!fs.existsSync(dir)) return;
        
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(baseDir, fullPath); 
          
          if (entry.isDirectory()) {
            scan(fullPath, baseDir);
          } else if (entry.isFile()) {
            if (entry.name === 'spa-manifest.json') continue;
            if (entry.name.endsWith('.DS_Store')) continue;
            // Normalize path separators to forward slashes for JSON
            files.push('/' + relativePath.split(path.sep).join('/'));
          }
        }
      }

      scan(buildDir, buildDir);

      const spaManifest = {
        assets: files.map(url => ({
          url,
          revision: null 
        }))
      };
      
      try {
        fs.writeFileSync(
          path.resolve(buildDir, 'spa-manifest.json'),
          JSON.stringify(spaManifest, null, 2)
        );
        console.log('✅ Generated spa-manifest.json with', files.length, 'assets');
      } catch (error) {
        console.error('❌ Failed to write spa-manifest.json', error);
      }
    }
  };
}

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
    tailwindcss(),
    spaManifestPlugin(),
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
