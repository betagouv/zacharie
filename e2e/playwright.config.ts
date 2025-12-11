/// <reference types="node" />

import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";
import dotenv from "dotenv";

dotenv.config();

// https://playwright.dev/docs/test-configuration
// note: if you want to debug a test, also uncomment .github/workflows/tests.yml last lines
const debugConfig: PlaywrightTestConfig = {
  testDir: "./tests",
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: true,
  retries: 0,
  workers: 1,
  reporter: [["html"], ["github"], ["list"], ["junit", { outputFile: "test-results/junit.xml" }]],
  use: {
    actionTimeout: 0,
    baseURL: "http://localhost:3290",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    launchOptions: {
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => console.log(`[${name}] ${severity}: ${message}`),
      },
    },
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
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--no-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu",
            "--enable-logging",
            "--v=1",
          ],
        },
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
      stdout: "pipe",
      stderr: "pipe",
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

const defaultFastConfig: PlaywrightTestConfig = {
  testDir: "./tests",
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0, // put 2 if you don't care about flaky tests. 0 won't make flaky pass, so you'll need to fix them.
  workers: "100%",
  reporter: process.env.CI ? "dot" : "list",
  use: {
    actionTimeout: 0,
    baseURL: "http://localhost:3290",
    trace: "on-first-retry",
  },
  projects: [
    /* 
firefox doesn't work for mobile tests
    {
      name: "firefox",
      use: {
        ...devices["Desktop Firefox"],
      },
    },
 */
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],

  webServer: [
    {
      command:
        "VITE_HOST=127.0.0.1:3290 VITE_SCHEME=http VITE_TEST=true VITE_TEST_PLAYWRIGHT=true VITE_API_URL=http://localhost:3291 PORT=3290 npm run dev-test --prefix ../app-local-first-react-router",
      port: 3290,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
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
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "3291",
        NODE_ENV: "test",
        PGDATABASE: "zacharietest",
      },
    },
  ],
};

export default defaultFastConfig;
