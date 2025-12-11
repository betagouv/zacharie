/// <reference types="node" />

import type { PlaywrightTestConfig } from "@playwright/test";
import { devices } from "@playwright/test";
import dotenv from "dotenv";

// Read from default ".env" file.
dotenv.config();

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
const config: PlaywrightTestConfig = {
  testDir: "./tests",
  /* Maximum time one test can run for. */
  timeout: 60 * 1000,
  expect: {
    /**
     * Maximum time expect() should wait for the condition to be met.
     * For example in `await expect(locator).toHaveText();`
     */
    timeout: 5000,
  },
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: true,
  /* Retry on CI only */
  retries: 0, // Enable retries in CI
  /* Opt out of parallel tests on CI. */
  workers: 1,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    ["html"], // HTML report for artifacts
    ["github"], // GitHub Actions integration
    ["list"], // Detailed console output
    ["junit", { outputFile: "test-results/junit.xml" }], // For CI integration
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3290",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",

    /* Enable more verbose logging in CI */
    launchOptions: {
      logger: {
        isEnabled: () => true,
        log: (name, severity, message) => console.log(`[${name}] ${severity}: ${message}`),
      },
    },
  },

  /* Configure projects for major browsers */
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
        launchOptions: {
          args: [
            "--disable-web-security",
            "--disable-features=VizDisplayCompositor",
            "--no-sandbox", // Often needed in CI environments
            "--disable-dev-shm-usage", // Overcome limited resource problems
            "--disable-gpu", // Applicable to Windows
            "--enable-logging",
            "--v=1", // Verbose logging
          ],
        },
      },
    },

    // {
    //   name: "webkit",
    //   use: {
    //     ...devices["Desktop Safari"],
    //   },
    // },

    /* Test against mobile viewports. */
    // {
    //   name: 'Mobile Chrome',
    //   use: {
    //     ...devices['Pixel 5'],
    //   },
    // },
    // {
    //   name: 'Mobile Safari',
    //   use: {
    //     ...devices['iPhone 12'],
    //   },
    // },

    /* Test against branded browsers. */
    // {
    //   name: 'Microsoft Edge',
    //   use: {
    //     channel: 'msedge',
    //   },
    // },
    // {
    //   name: 'Google Chrome',
    //   use: {
    //     channel: 'chrome',
    //   },
    // },
  ],

  /* Folder for test artifacts such as screenshots, videos, traces, etc. */
  outputDir: "test-results/",

  /* Run your local dev server before starting the tests */

  webServer: [
    {
      command:
        "VITE_HOST=127.0.0.1:3290 VITE_SCHEME=http VITE_TEST=true VITE_TEST_PLAYWRIGHT=true VITE_API_URL=http://localhost:3291 PORT=3290 npm run dev-test --prefix ../app-local-first-react-router",
      port: 3290,
      timeout: 120 * 1000,
      reuseExistingServer: false,
      /* Enhanced server logging in CI */
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
      /* Enhanced server logging in CI */
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
