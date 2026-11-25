import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG');
});

test('ETG refuse toutes les carcasses → chasseur voit refus', async ({ page }) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse refusée').click();
  await page
    .getByLabel('Daim - N° MM-001-001')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page
    .getByLabel('Daim - N° MM-001-002')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse refusée').click();
  await page
    .getByLabel('Daim - N° MM-001-004')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByText('Lot refusé').click();
  await page
    .getByLabel('Pigeons - N° MM-001-')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' })).toBeVisible();

  await page.setViewportSize({ width: 350, height: 667 });
  await logoutAndConnect(page, 'examinateur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: /Daim N° MM-001-001/ })).toBeVisible({ timeout: 15000 });
});
