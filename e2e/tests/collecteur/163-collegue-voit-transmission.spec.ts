import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 163 — Un collègue de la même entreprise de collecte voit la prise en charge et la transmission.
// Sophie (collecteur-pro@) prend en charge, refuse une carcasse et transmet à ETG 1. Julie
// (collecteur-pro-1-bis@, même entreprise) ouvre la fiche : elle doit voir que la fiche est partie,
// la carcasse refusée, et le prochain destinataire dans le parcours de la fiche.

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});
test.use({ launchOptions: { slowMo: 100 } });

test('Un collègue voit la prise en charge, le refus et la transmission faits par un autre membre', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-175242';

  await connectWith(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ }).click();
  // why: la modale DSFR des carcasses rate le clic pendant les re-rendus qui suivent la prise en charge
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page
    .getByLabel('Daim - N° MM-001-002')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();
  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const transmettre = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText('ETG 1 a été notifié')).toBeVisible({ timeout: 10000 });

  // Julie, collègue de Sophie, ouvre la fiche
  await logoutAndConnect(page, 'collecteur-pro-1-bis@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();

  await expect(page.getByText('Fiche envoyée, pas encore prise en charge')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Transport vers un établissement de traitement')).not.toBeVisible();

  // la carcasse refusée par Sophie est visible
  await expect(page.getByRole('button', { name: /Daim N° MM-001-002 Mise à/ })).toBeVisible();
  await expect(page.getByText('Refusée par Collecteur Pro 1')).toBeVisible();

  // la transmission faite par Sophie est visible
  await expect(page.getByText('Sélection du prochain destinataire')).toBeVisible();
  await expect(page.locator("[class*='select-prochain-detenteur__single-value']")).toHaveText(/^ETG 1 - /);

  // le parcours de la fiche se termine par le prochain destinataire, en attente de prise en charge
  const tracabilite = page.getByRole('group').filter({
    has: page.getByRole('heading', { name: 'Données de traçabilité' }),
  });
  await expect(tracabilite.getByText('ETG 1', { exact: true })).toBeVisible();
  await expect(tracabilite.getByText('Réception des carcasses')).toBeVisible();
  await expect(tracabilite.getByText('En attente de prise en charge', { exact: true })).toBeVisible();
});
