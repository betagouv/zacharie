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

test('Stockage CCG choisi mais aucune CCG renseignée → erreur', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();

  await page.getByText('Carcasses déposées dans un Centre').click();
  // Ne PAS renseigner de CCG

  // Error message should appear below — may need to scroll
  const errorMsg = page.getByText(/Il manque le.*centre de collecte|Renseigner ma chambre froide/i).first();
  await errorMsg.scrollIntoViewIfNeeded();
  await expect(errorMsg).toBeVisible({ timeout: 10000 });
});
