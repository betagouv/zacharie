import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// Scenario 106 — Service worker cache : reload offline.
// SKIP: e2e webServer runs Vite dev mode, where __WB_MANIFEST is empty (no precache) and
// HMR-hashed JS URLs prevent reliable runtime caching by the SW. Reload-offline returns
// net::ERR_INTERNET_DISCONNECTED because the SW didn't intercept the dev-mode bundle.
// To unskip: switch the e2e webServer to a production preview (build + vite preview) so
// the precache manifest is populated.
test.skip('Service worker : reload offline charge depuis le runtime cache', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.waitForLoadState('networkidle');

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 20000 });
  await context.setOffline(false);
});
