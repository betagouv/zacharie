import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});
test.use({ launchOptions: { slowMo: 100 } });

test('ETG refuse toutes les carcasses → la fiche reste éditable (pas de verrou avant le SVI)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));

  const refuseGrandGibier = async (bracelet: string) => {
    await page.getByRole('button', { name: `Daim N° ${bracelet} Mise à` }).click();
    await page.getByLabel(`Daim - N° ${bracelet}`).getByText('Carcasse refusée').click();
    await page
      .getByLabel(`Daim - N° ${bracelet}`)
      .locator('.input-for-search-prefilled-data__input-container')
      .click();
    await page.getByRole('option', { name: 'Présence de souillures' }).click();
    await page.getByLabel(`Daim - N° ${bracelet}`).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: `Daim N° ${bracelet} Mise à` })).toBeVisible();
  };

  await refuseGrandGibier('MM-001-001');
  await refuseGrandGibier('MM-001-002');
  await refuseGrandGibier('MM-001-004');

  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByText('Lot refusé').click();
  await page
    .getByLabel('Pigeons - N° MM-001-')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('button', { name: /Pigeons \(10\) N° MM-001-003.*Refusé par ETG 1/ })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();

  await expect(
    page.getByRole('button', { name: /Daim N° MM-001-001 Mise à mort.*Acceptée par ETG 1/ })
  ).toBeVisible();
});
