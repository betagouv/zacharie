import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

/**
 * Inspection : mise en consigne (IPM1 MISE_EN_CONSIGNE).
 * On vérifie que les champs obligatoires (durée, pièces, lésions) apparaissent, qu'un
 * enregistrement sans pièces ni lésions est bloqué avec un message visible, puis qu'une
 * IPM1 complète est confirmée comme enregistrée et envoyée au serveur.
 */
test('76 - SVI inspection : carcasse consignée (IPM1 MISE_EN_CONSIGNE)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole('link', { name: feiId }).click();

  await page.getByRole('button', { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();

  // "Mise en consigne" is the default IPM1 decision; durée de consigne field appears
  await expect(page.getByLabel('Mise en consigne', { exact: true })).toBeChecked();
  await expect(page.getByLabel(/Durée de la consigne/)).toBeVisible();
  await expect(page.getByText('Lésion ou motif *').first()).toBeVisible();
  await expect(page.getByText('Observations (lésions)')).toHaveCount(0);

  const dateShortcut = page.getByRole('button', { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Fill durée
  await page.getByLabel(/Durée de la consigne/).fill('24');
  await page.getByLabel(/Durée de la consigne/).blur();

  // Sans pièces ni lésions : l'enregistrement est bloqué et le SVI voit pourquoi
  const saveBtn = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await expect(page.getByText('IPM1 non enregistrée')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Il manque les pièces inspectées nécessitant une observation')).toBeVisible();

  // Pièces + lésions renseignées : l'IPM1 est enregistrée puis envoyée
  await page.locator('.input-for-search-prefilled-data__input-container').first().click();
  await page.getByRole('option').first().click();
  await page.locator('.input-for-search-prefilled-data__input-container').nth(1).click();
  await page.getByRole('option').first().click();

  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await expect(page.getByText('IPM1 non enregistrée')).toHaveCount(0);
  await expect(page.getByText('IPM1 enregistrée', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Elle a été envoyée au serveur.')).toBeVisible();
});
