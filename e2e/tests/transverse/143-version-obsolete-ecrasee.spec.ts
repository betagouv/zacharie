import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

// Verrou optimiste du /sync (api-express/src/utils/sync-version.ts). Deux agents de SVI 1 ont la même
// fiche chargée. L'agent A passe hors ligne. L'agent B, en ligne, met la carcasse MM-001-001 en
// consigne : la version de la carcasse monte en base. L'agent A, toujours hors ligne, accepte la même
// carcasse sur sa copie locale, désormais périmée.
// Au retour en ligne, l'écriture de A part avec une version inférieure à celle de la base, écrite par
// un autre utilisateur : elle est refusée (« Version obsolète »), le serveur touche la carcasse, et le
// delta de loadCarcasses remplace la copie locale de A par la version serveur. L'acceptation faite hors
// ligne par A est perdue.
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

  // --- Agent A : charge la fiche puis passe hors ligne.
  await connectWith(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(carte(page).getByRole('button', { name: 'Accepter' })).toBeVisible({ timeout: 10000 });
  await page.context().setOffline(true);

  // --- Agent B (autre membre de SVI 1), en ligne : IPM1 « Mise en consigne » sur MM-001-001.
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

  // --- Agent A, toujours hors ligne : accepte MM-001-001 sur sa copie locale périmée.
  const accepterA = carte(page).getByRole('button', { name: 'Accepter' });
  await accepterA.scrollIntoViewIfNeeded();
  await accepterA.click();
  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });

  // --- Retour en ligne : l'écriture de A est refusée comme périmée.
  const syncA = page.waitForResponse(isSyncPost, { timeout: 15000 });
  await page.context().setOffline(false);
  const rejected = (await (await syncA).json()).data.rejected as Array<{ id: string; reason: string }>;
  expect(rejected).toContainEqual(
    expect.objectContaining({ id: expect.stringMatching(/MM-001-001$/), reason: 'Version obsolète' })
  );

  // Le delta remplace la copie locale de A par la version serveur : la décision de B.
  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Mise en consigne/)).toBeVisible({ timeout: 15000 });
  await expect(carte(page).getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeHidden();
});
