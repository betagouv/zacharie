import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 48 — L'ETG renvoie la fiche à l'expéditeur : next_owner est vidé mais le destinataire choisi
// par le premier détenteur reste en cache. Côté chasseur, les carcasses ne sont plus « Envoyée à ETG 1 »
// mais « Renvoyée par ETG 1, à attribuer de nouveau ».
test("Carcasses renvoyées par l'ETG : le premier détenteur les voit à attribuer de nouveau", async ({
  page,
}) => {
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

  await logoutAndConnect(page, 'premier-detenteur@example.fr');
  const pdLink = page.getByRole('link', { name: new RegExp(feiId) });
  await expect(pdLink).toBeVisible({ timeout: 10000 });
  await pdLink.click();

  const groupeRenvoye = page.getByText(/Renvoyée par ETG 1, à attribuer de nouveau/);
  await expect(groupeRenvoye).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Envoyée à ETG 1/)).toHaveCount(0);
  await expect(page.getByText('MM-001-001').first()).toBeVisible();
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
});
