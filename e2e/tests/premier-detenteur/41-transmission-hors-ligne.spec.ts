import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Transmission hors-ligne — sync auto au retour en ligne', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Hors-ligne
  await context.setOffline(true);

  const transmettre = page.getByRole('button', { name: 'Transmettre' });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  // UI locale affiche le succès local (pas de beacon serveur)
  // TODO: verify behavior when offline — maybe shows "En attente de synchronisation"
  await expect(page.getByText(/transmise|synchronisation|hors.?ligne/i).first()).toBeVisible({
    timeout: 10000,
  });

  // Retour online
  await context.setOffline(false);

  // Sync attendue — reconnect ETG 1
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
