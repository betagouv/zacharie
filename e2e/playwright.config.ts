/// <reference types="node" />

import type { PlaywrightTestConfig } from '@playwright/test';
import { devices } from '@playwright/test';

const config: PlaywrightTestConfig = {
  testDir: './tests',
  timeout: 60 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: true,
  forbidOnly: process.env.CI ? true : false,
  retries: 0,
  workers: 1,
  reporter: [['html']],
  use: {
    actionTimeout: 15 * 1000,
    baseURL: 'http://localhost:3290',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
      },
    },
  ],
  outputDir: 'test-results/',
  webServer: [
    {
      command:
        'PORT=3291 NODE_ENV=test PGDATABASE=zacharietest VITE_FEATURE_TRICHINE=true npm run dev-test --prefix ../api-express',
      url: 'http://localhost:3291/healthz',
      timeout: 120 * 1000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'ignore',
      env: {
        PORT: '3291',
        NODE_ENV: 'test',
        PGDATABASE: 'zacharietest',
        VITE_FEATURE_TRICHINE: 'true',
      },
    },
    {
      command:
        'VITE_HOST=127.0.0.1:3290 VITE_SCHEME=http VITE_TEST=true VITE_TEST_PLAYWRIGHT=true VITE_FEATURE_TRICHINE=true VITE_API_URL=http://localhost:3291 PORT=3290 npm run dev-test --prefix ../app-local-first-react-router',
      url: 'http://localhost:3290',
      timeout: 120 * 1000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'ignore',
      env: {
        PORT: '3290',
        VITE_HOST: '127.0.0.1:3290',
        VITE_SCHEME: 'http',
        VITE_TEST: 'true',
        VITE_TEST_PLAYWRIGHT: 'true',
        VITE_FEATURE_TRICHINE: 'true',
      },
    },
    {
      command: 'npm run dev-test --prefix ../api-playground',
      url: 'http://localhost:3292/connexion',
      timeout: 120 * 1000,
      reuseExistingServer: true,
      stdout: 'ignore',
      stderr: 'ignore',
      env: {
        DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/zacharie-api-playground-test',
        ZACHARIE_API_URL: 'http://localhost:3291',
        ZACHARIE_APP_URL: 'http://localhost:3290',
      },
    },
  ],
};

export default config;
