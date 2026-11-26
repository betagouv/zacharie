import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('75 - SVI inspection : carcasse refusée (saisie totale via IPM2)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole('link', { name: feiId }).click();

  await page.getByRole('button', { name: /Daim.*MM-001-002/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();

  await expect(page.getByLabel('Mise en consigne', { exact: true })).toBeChecked();

  const dateShortcut = page.getByRole('button', { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  await page.locator('.input-for-search-prefilled-data__input-container').first().click();
  await page.getByRole('option').first().click();

  await page.locator('.input-for-search-prefilled-data__input-container').nth(1).click();
  await page.getByRole('option').first().click();

  await page.getByLabel(/Durée de la consigne/).fill('24');
  await page.getByLabel(/Durée de la consigne/).blur();

  page.once('dialog', (d) => d.accept());
  const saveBtn = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  await expect(page.getByText(/Inspection Post-Mortem 2/)).toBeVisible({ timeout: 10000 });

  await expect(page.getByLabel('Saisie totale', { exact: true })).toBeVisible();
});
