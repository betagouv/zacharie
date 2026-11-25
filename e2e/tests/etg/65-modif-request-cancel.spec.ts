import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Annulation : le demandeur peut annuler sa propre demande pendante', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  await page.getByRole('button', { name: 'Corriger le numéro de marquage' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();

  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });

  const syncResponse = page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
  await page.getByRole('button', { name: 'Annuler la correction' }).click();

  await expect(page.getByText('Numéro de marquage corrigé')).toHaveCount(0, { timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toHaveCount(0);
  await syncResponse;

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByRole('button', { name: 'Corriger le numéro de marquage' })).toBeVisible();
});
