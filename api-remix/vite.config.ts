import { vitePlugin as remix } from "@remix-run/dev";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { installGlobals } from "@remix-run/node";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import dayjs from "dayjs";

installGlobals();

const buildId = JSON.stringify(`${dayjs().format("DD-MM-YYYY")} vers ${dayjs().format("HH")}:00`);
process.env.VITE_BUILD_ID = buildId;

export default defineConfig(({ mode }) => {
  return {
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
        ssr: true,
        buildDirectory: "build-api",

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
        "~": "/app",
      },
    },
    worker: {
      format: "es",
    },
  };
});
