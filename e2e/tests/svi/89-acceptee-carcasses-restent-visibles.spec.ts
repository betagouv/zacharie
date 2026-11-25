import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG');
});

test('89 - SVI : accepter une carcasse ne la fait pas disparaître après reconnexion', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  const carcasseBtn = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  const dateShortcut = page.getByRole('button', { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();
  const ipm1Decision = page.locator('fieldset').filter({ hasText: 'Décision IPM1' }).first();
  await ipm1Decision.scrollIntoViewIfNeeded();
  await ipm1Decision.getByLabel(/Acceptée/).check({ force: true });

  const syncResponse = page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
  page.once('dialog', (d) => d.accept());
  const saveBtn = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await syncResponse;

  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: /Daim.*MM-001-001/ }).first()).toBeVisible({
    timeout: 10000,
  });
});
