import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 55 — Post-inspection SVI : décision visible côté ETG.
test('ETG voit la décision SVI après clôture', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  const feiId = 'ZACH-20250707-QZ6E0-205242';
  const feiLink = page.getByRole('link', { name: new RegExp(feiId) }).first();
  await expect(feiLink).toBeVisible({ timeout: 10000 });
  await feiLink.click();

  // Carcasses are ACCEPTE per SVI_CLOSED seed (svi_carcasse_status: ACCEPTE for all 4).
  // Decision text should be visible on the fiche detail page.
  await expect(page.getByText(/accept/i).first()).toBeVisible({ timeout: 10000 });
});
