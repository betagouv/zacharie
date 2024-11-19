import { sentryVitePlugin } from "@sentry/vite-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import checker from "vite-plugin-checker";
import { resolve } from "path";
import dayjs from "dayjs";

const buildId = JSON.stringify(`${dayjs().format("DD-MM-YYYY")} vers ${dayjs().format("HH")}:00`);
process.env.VITE_BUILD_ID = buildId;

// https://vitejs.dev/config/
export default defineConfig({
  base: "/",
  plugins: [
    react(),
    sentryVitePlugin({
      org: "mano-20",
      project: "mano-espace",
      telemetry: false,
      disable: !process.env.CI,
    }),
    !process.env.VITEST ? checker({ typescript: true }) : undefined,
  ],
  build: {
    outDir: "build",
    sourcemap: true,
  },
  resolve: {
    alias: {
      ".prisma/client/index-browser": "./node_modules/.prisma/client/index-browser.js",
      "@app": "/src",
      "@api": resolve(__dirname, "../api-express/src"),
      "~": resolve(__dirname, "../api-express/src"),
    },
  },
  define: {
    __VITE_BUILD_ID__: buildId,
    "process.env": process.env,
  },
});
