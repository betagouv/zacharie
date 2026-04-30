import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 73 — Hors-ligne : prise en charge locale → sync au retour en ligne.
test('Collecteur transmet hors-ligne puis sync online', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-175242';
  await connectWith(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur', { timeout: 10000 });
  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await page
    .getByRole('button', { name: /Je contrôle et transporte les carcasses|Prendre en charge/ })
    .click();

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  const selectDest = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectDest.scrollIntoViewIfNeeded();
  await selectDest.click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  // Storage location is required before Transmettre
  const pasDeStockage = page.getByText(/Pas de stockage/i).first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const transmettre = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  await context.setOffline(false);
  await expect(page.getByText(/ETG 1 a été notifié/)).toBeVisible({ timeout: 15000 });
});
