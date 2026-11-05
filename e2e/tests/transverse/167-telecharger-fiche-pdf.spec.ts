import { readFileSync } from 'node:fs';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 167 — Le SVI et l'ETG téléchargent un extrait PDF de la fiche depuis sa page.

test.use({ launchOptions: { slowMo: 100 } });

test('SVI : télécharger la fiche en PDF', async ({ page }) => {
  await resetDb('SVI_CLOSED');
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}/`));

  const bouton = page.getByRole('button', { name: 'Télécharger la fiche en PDF' });
  await bouton.scrollIntoViewIfNeeded();
  const downloadPromise = page.waitForEvent('download');
  await bouton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`fiche-${feiId}.pdf`);
  expect(readFileSync(await download.path()).subarray(0, 4).toString()).toBe('%PDF');
});

test('ETG : télécharger la fiche en PDF', async ({ page }) => {
  await resetDb('ETG_TAKEN_CHARGE');
  const feiId = 'ZACH-20250707-QZ6E0-235242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/);
  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}/`));

  const bouton = page.getByRole('button', { name: 'Télécharger la fiche en PDF' });
  await bouton.scrollIntoViewIfNeeded();
  const downloadPromise = page.waitForEvent('download');
  await bouton.click();
  const download = await downloadPromise;

  expect(download.suggestedFilename()).toBe(`fiche-${feiId}.pdf`);
  expect(readFileSync(await download.path()).subarray(0, 4).toString()).toBe('%PDF');
});
