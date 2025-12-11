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
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  // retries: process.env.CI ? 2 : 0,
  retries: process.env.CI ? 2 : 0, // Enable retries in CI
  /* Opt out of parallel tests on CI. */
  //  workers: process.env.CI ? 1 : undefined,
  workers: process.env.CI ? 1 : undefined, // Single worker in CI for stability
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: process.env.CI
    ? [
        ["html"], // HTML report for artifacts
        ["github"], // GitHub Actions integration
        ["list"], // Detailed console output
        ["junit", { outputFile: "test-results/junit.xml" }], // For CI integration
      ]
    : "html",
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Maximum time each action such as `click()` can take. Defaults to 0 (no limit). */
    actionTimeout: 0,
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: "http://localhost:3290",

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: process.env.CI ? "retain-on-failure" : "on-first-retry",
    screenshot: process.env.CI ? "only-on-failure" : "off",
    video: process.env.CI ? "retain-on-failure" : "off",

    /* Enable more verbose logging in CI */
    ...(process.env.CI && {
      launchOptions: {
        logger: {
          isEnabled: () => true,
          log: (name, severity, message) => console.log(`[${name}] ${severity}: ${message}`),
        },
      },
    }),
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
        ...(process.env.CI && {
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
        }),
      },
    },

    // ...(!!process.env.CI
    //   ? []
    //   : [
    //       {
    //         name: "chromium",
    //         use: {
    //           ...devices["Desktop Chrome"],
    //         },
    //       },
    //     ]),

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
  // webServer: {
  //  command: "npm run start",
  //  port: 8083,
  //  timeout: 120 * 1000,
  //  reuseExistingServer: !process.env.CI,
  // },

  webServer: [
    {
      command:
        "VITE_HOST=127.0.0.1:3290 VITE_SCHEME=http VITE_TEST=true VITE_TEST_PLAYWRIGHT=true VITE_API_URL=http://localhost:3291 PORT=3290 npm run dev-test --prefix ../app-local-first-react-router",
      port: 3290,
      timeout: 120 * 1000,
      reuseExistingServer: !process.env.CI,
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
      reuseExistingServer: !process.env.CI,
      /* Enhanced server logging in CI */
      stdout: process.env.CI ? "pipe" : "ignore",
      stderr: process.env.CI ? "pipe" : "ignore",
      env: {
        PORT: "3291",
        NODE_ENV: "test",
        PGDATABASE: "zacharietest",
      },
    },
  ],
};

export default config;
