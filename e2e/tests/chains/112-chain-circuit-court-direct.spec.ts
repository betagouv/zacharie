import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 112 — Chain circuit court direct : PD → Commerce de detail (sans ETG, sans transport).
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Chain circuit court : PD → Commerce de détail (sans ETG)', async ({ page }) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD prend en charge + transmet directement au commerce de detail — circuit court = no transport
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /Commerce de Détail 1/i }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  // Circuit court: NO transport step needed
  const transmettreBtn = page.getByRole('button', { name: 'Transmettre' });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. Commerce de detail recoit
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'commerce-de-detail@example.fr');
  await expect(page).toHaveURL(/\/app\/circuit-court/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
