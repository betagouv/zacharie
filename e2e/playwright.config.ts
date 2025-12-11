/// <reference types="node" />

import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: "./tests",
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: process.env.CI ? true : false,
  retries: 0,
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"], // HTML report for artifacts
    ["github"], // GitHub Actions integration
    ["list"], // Detailed console output
    ["junit", { outputFile: "test-results/junit.xml" }], // For CI integration
  ],
  use: {
    actionTimeout: 0,
    baseURL: "http://localhost:3290",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // launchOptions: {
    //   logger: {
    //     isEnabled: () => true,
    //     log: (name, severity, message) => console.log(`[${name}] ${severity}: ${message}`),
    //   },
    // },
  },
  projects: [
    // firefox doesn't work for mobile tests
    /* {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    }, */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        /* CI-specific browser options for better debugging */
        // launchOptions: {
        //   args: [
        //     "--disable-web-security",
        //     "--disable-features=VizDisplayCompositor",
        //     "--no-sandbox", // Often needed in CI environments
        //     "--disable-dev-shm-usage", // Overcome limited resource problems
        //     "--disable-gpu", // Applicable to Windows
        //     "--enable-logging",
        //     "--v=1", // Verbose logging
        //   ],
        // },
      },
    },
  ],
  outputDir: "test-results/",
  webServer: [
    {
      command:
        "VITE_HOST=127.0.0.1:3290 VITE_SCHEME=http VITE_TEST=true VITE_TEST_PLAYWRIGHT=true VITE_API_URL=http://localhost:3291 PORT=3290 npm run dev-test --prefix ../app-local-first-react-router",
      port: 3290,
      timeout: 120 * 1000,
      reuseExistingServer: false,
      // server logs are too verbose, only display when current browser logs are not enough
      stdout: "ignore",
      stderr: "ignore",
      env: {
        PORT: "3290",
        VITE_HOST: "127.0.0.1:3290",
        VITE_SCHEME: "http",
        VITE_TEST: "true",
        VITE_TEST_PLAYWRIGHT: "true",
      },
    },
    {
      command: "PORT=3291 NODE_ENV=test PGDATABASE=zacharietest npm run dev-test --prefix ../api-express",
      port: 3291,
      timeout: 120 * 1000,
      reuseExistingServer: false,
      stdout: "pipe",
      stderr: "pipe",
      env: {
        PORT: "3291",
        NODE_ENV: "test",
        PGDATABASE: "zacharietest",
      },
    },
  ],
};

export default config;
