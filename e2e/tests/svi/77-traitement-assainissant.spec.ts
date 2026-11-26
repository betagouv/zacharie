import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('77 - SVI inspection : traitement assainissant (IPM2)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole('link', { name: feiId }).click();

  await page.getByRole('button', { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();
  await expect(page.getByLabel('Mise en consigne', { exact: true })).toBeChecked();

  await page
    .getByRole('button', { name: /Cliquez ici/ })
    .first()
    .click();

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

  const traitementRadio = page.getByLabel('Traitement assainissant', { exact: true });
  await expect(traitementRadio).toBeVisible();

  await page.locator('label.fr-label:has-text("Traitement assainissant")').first().click();
  await expect(page.getByLabel('Cuisson')).toBeVisible();
  await expect(page.getByLabel('Congélation')).toBeVisible();
  await expect(page.getByLabel('Autre')).toBeVisible();
});
