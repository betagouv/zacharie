import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('143 - une écriture hors ligne sur une version périmée est refusée et remplacée par la version serveur', async ({
  page,
  browser,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  const carte = (p: typeof page) => p.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  const isSyncPost = (resp: {
    url: () => string;
    request: () => { method: () => string };
    ok: () => boolean;
  }) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok();

  await connectWith(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(carte(page).getByRole('button', { name: 'Accepter' })).toBeVisible({ timeout: 10000 });
  await page.context().setOffline(true);

  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await connectWith(pageB, 'svi-1-bis@example.fr');
  await pageB.getByRole('link', { name: feiId }).click();
  await carte(pageB).getByText('N° MM-001-001').click();
  await expect(pageB).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(pageB.getByLabel('Mise en consigne', { exact: true })).toBeChecked();
  const dateShortcut = pageB.getByRole('button', { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();
  await pageB.locator('.input-for-search-prefilled-data__input-container').first().click();
  await pageB.getByRole('option').first().click();
  await pageB.locator('.input-for-search-prefilled-data__input-container').nth(1).click();
  await pageB.getByRole('option').first().click();
  await pageB.getByLabel(/Durée de la consigne/).fill('24');
  await pageB.getByLabel(/Durée de la consigne/).blur();
  pageB.once('dialog', (d) => d.accept());
  const syncB = pageB.waitForResponse(isSyncPost, { timeout: 15000 });
  const saveBtn = pageB.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await syncB;
  await expect(pageB.getByText(/Inspection Post-Mortem 2/)).toBeVisible({ timeout: 10000 });
  await contextB.close();

  const accepterA = carte(page).getByRole('button', { name: 'Accepter' });
  await accepterA.scrollIntoViewIfNeeded();
  await accepterA.click();
  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });

  const syncA = page.waitForResponse(isSyncPost, { timeout: 15000 });
  await page.context().setOffline(false);
  const rejected = (await (await syncA).json()).data.rejected as Array<{ id: string; reason: string }>;
  expect(rejected).toContainEqual(
    expect.objectContaining({ id: expect.stringMatching(/MM-001-001$/), reason: 'Version obsolète' })
  );

  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Mise en consigne/)).toBeVisible({ timeout: 15000 });
  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeHidden();
});
