import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 171 — Le même compte ETG est ouvert sur deux appareils. La fiche renvoyée à l'expéditeur
// depuis le premier sort du périmètre : le pull delta du second ne la lui renvoie jamais. Au
// chargement suivant, le contrôle d'intégrité voit une carcasse en trop et recharge tout le périmètre :
// la fiche disparaît aussi du second appareil.
test("Fiche renvoyée depuis un autre appareil : elle disparaît de l'appareil resté ouvert", async ({
  page,
  browser,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  const autreAppareil = await browser.newContext();
  const pageAutreAppareil = await autreAppareil.newPage();
  await connectWith(pageAutreAppareil, 'etg-1@example.fr');
  await expect(pageAutreAppareil).toHaveURL('http://localhost:3290/app/etg');
  await expect(pageAutreAppareil.getByRole('link', { name: new RegExp(feiId) })).toBeVisible({
    timeout: 10000,
  });

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  const link = page.getByRole('link', { name: new RegExp(feiId) });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  const returnBtn = page.getByRole('button', { name: /Renvoyer à l'expéditeur/ });
  await expect(returnBtn).toBeVisible({ timeout: 10000 });
  await returnBtn.scrollIntoViewIfNeeded();
  await returnBtn.click();
  await expect(page.getByText("Êtes-vous sûr de renvoyer cette fiche à l'expéditeur")).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer le renvoi' }).click();
  await expect(page.getByText("La fiche a été renvoyée à l'expéditeur")).toBeVisible({ timeout: 10000 });

  // le renvoi part en synchro après le toast : on recharge jusqu'à ce que le serveur l'ait reçu
  await expect(async () => {
    await pageAutreAppareil.reload();
    await expect(pageAutreAppareil).toHaveURL('http://localhost:3290/app/etg');
    await expect(pageAutreAppareil.getByRole('link', { name: new RegExp(feiId) })).toHaveCount(0, {
      timeout: 5000,
    });
  }).toPass({ timeout: 30000 });

  await autreAppareil.close();
});
