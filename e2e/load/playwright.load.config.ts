/// <reference types="node" />
import path from 'path';
import type { PlaywrightTestConfig } from '@playwright/test';
import baseConfig from '../playwright.config';

// Test de charge, hors de la suite e2e : voir load/README.md
const config: PlaywrightTestConfig = {
  ...baseConfig,
  testDir: '.',
  timeout: 3 * 60 * 60 * 1000,
  reporter: [['list']],
  use: {
    ...baseConfig.use,
    trace: 'off',
    video: 'off',
    actionTimeout: 0,
  },
  outputDir: '../test-results-load/',
  // l'API et l'app seulement (pas le bac à sable de l'API) ; les commandes des serveurs utilisent
  // des chemins relatifs au dossier e2e/
  webServer: (Array.isArray(baseConfig.webServer) ? baseConfig.webServer : [])
    .filter((server) => !server.command.includes('api-playground'))
    .map((server) => ({ ...server, cwd: path.resolve(__dirname, '..') })),
};

export default config;
