import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 71 — Renvoi à l'expéditeur : la fiche quitte la liste de l'ETG, et elle n'y revient pas
// après rechargement. Le périmètre serveur ne l'accorde plus à cet ETG, et le masquage est persisté.
test("ETG renvoie la fiche à l'expéditeur : elle disparaît de sa liste", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
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
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await expect(page.getByRole('link', { name: new RegExp(feiId) })).toHaveCount(0, { timeout: 10000 });

  // Le rechargement repart de la donnée persistée puis d'un pull serveur : la fiche reste absente.
  await page.reload();
  await expect(page.getByRole('link', { name: new RegExp(feiId) })).toHaveCount(0, { timeout: 10000 });
});
