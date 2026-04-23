import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 59 — Double prise en charge : deux users du même ETG cliquent "Prendre en charge"
// quasi-simultanément → un seul effet, pas de duplication.
test('Double clic Prendre en charge ne duplique pas', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const btn = page.getByRole('button', { name: 'Prendre en charge les carcasses' });
  await btn.scrollIntoViewIfNeeded();
  // Double-clic rapide
  await btn.dblclick();

  await expect(
    page.getByRole('heading', { name: 'Réception par mon établissement de traitement' })
  ).toBeVisible({ timeout: 10000 });
  // Only one heading — no duplication
  await expect(
    page.getByRole('heading', { name: 'Réception par mon établissement de traitement' })
  ).toHaveCount(1);
});
