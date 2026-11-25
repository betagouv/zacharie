import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

test("Collecteur renvoie la fiche à l'expéditeur", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-175242';
  await connectWith(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');

  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}`));

  await expect(page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ })).toBeVisible({
    timeout: 10000,
  });

  const returnBtn = page.getByRole('button', { name: /Renvoyer à l'expéditeur/ });
  await expect(returnBtn).toBeVisible();
  await returnBtn.scrollIntoViewIfNeeded();
  await returnBtn.click();
  await expect(page.getByText("Êtes-vous sûr de renvoyer cette fiche à l'expéditeur")).toBeVisible();
  await page.getByRole('button', { name: 'Confirmer le renvoi' }).click();

  await expect(page.getByText("La fiche a été renvoyée à l'expéditeur")).toBeVisible({ timeout: 10000 });
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');
  await expect(page.getByRole('link', { name: new RegExp(feiId) })).toHaveCount(0, { timeout: 10000 });

  await page.reload();
  await expect(page.getByRole('link', { name: new RegExp(feiId) })).toHaveCount(0, { timeout: 10000 });
});
