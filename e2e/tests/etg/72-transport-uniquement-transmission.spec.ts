import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Un salarié d'ETG en « transport uniquement » n'a qu'à cliquer sur « Prendre en charge » :
// la fiche est automatiquement transmise à son ETG, où la réception peut la prendre en charge.
test('ETG transport uniquement - la prise en charge suffit à transmettre la fiche à mon ETG', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'collecteur-pro-1-etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();

  await page.getByRole('button', { name: 'Prendre en charge' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();

  await expect(page.locator("[class*='select-prochain-detenteur__single-value']")).toHaveText(/^ETG 1 - /, {
    timeout: 10000,
  });
  await expect(page.getByRole('heading', { name: 'Attribution effectuée' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('ETG 1 a été notifié')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Transmettre la fiche' })).toBeDisabled();

  // La réception de l'ETG reçoit la fiche et peut la prendre en charge
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).toBeVisible({ timeout: 10000 });
});
