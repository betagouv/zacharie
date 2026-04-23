import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 63 — Transmission à ETG : choisir ETG 1 → Transmettre → ETG voit la fiche.
test('Collecteur transmet à ETG 1 qui la reçoit', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-175242';
  await connectWith(page, 'collecteur-pro@example.fr');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();

  await page
    .getByRole('button', { name: /Je contrôle et transporte les carcasses|Prendre en charge/ })
    .click();

  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();

  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole('option', { name: /ETG 1/ }).click();

  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  const transmettre = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1.*notifié|fiche.*transmise/i).first()).toBeVisible({ timeout: 10000 });

  // L'ETG 1 voit la fiche.
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: new RegExp(feiId) })).toBeVisible({ timeout: 10000 });
});
