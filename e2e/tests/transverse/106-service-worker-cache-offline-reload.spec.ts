import { test } from '@playwright/test';

// Scenario 106 — [DIFFÉRÉ] Service worker cache offline reload.
// App should load from IndexedDB after refresh offline.
// TODO: implement once service worker registration strategy in e2e env is stable.
test.skip('Service worker : reload offline charge depuis IndexedDB', async () => {
  // TODO: implement — cf. app-local-first-react-router/src/service-worker.ts.
});
