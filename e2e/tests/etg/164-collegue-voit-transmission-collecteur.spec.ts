import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 164 — Un collègue du même ETG voit la prise en charge et la transmission à un collecteur.
// Thomas (etg-1@) prend en charge, refuse une carcasse et transmet à Collecteur Pro 2. Paul
// (etg-1-bis@, même ETG) ouvre la fiche : il doit voir que la fiche est partie, la carcasse refusée,
// et le prochain destinataire dans le parcours de la fiche.

test.beforeEach(async () => {
  await resetDb('ETG');
});
test.use({ launchOptions: { slowMo: 100 } });

test('Un collègue voit la prise en charge, le refus et la transmission à un collecteur', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();
  // why: la modale DSFR des carcasses rate le clic pendant les re-rendus qui suivent la prise en charge
  await new Promise((resolve) => setTimeout(resolve, 500));

  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page
    .getByLabel('Daim - N° MM-001-002')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeVisible();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'Collecteur Pro 2 - 75000' }).click();
  await expect(page.getByText('Il manque le prochain dé')).toBeHidden();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('Collecteur Pro 2 a été notifié')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Fiche envoyée, pas encore prise en charge')).toBeVisible();

  // Paul, collègue de Thomas, ouvre la fiche
  await logoutAndConnect(page, 'etg-1-bis@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();

  await expect(page.getByText('Fiche envoyée, pas encore prise en charge')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Prise en charge par l'atelier")).not.toBeVisible();

  // la carcasse refusée par Thomas est visible
  await expect(page.getByRole('button', { name: /Daim N° MM-001-002 Mise à/ })).toBeVisible();
  await expect(page.getByText('Refusé par ETG 1')).toBeVisible();

  // la transmission faite par Thomas est visible
  await expect(page.getByText('Sélection du prochain destinataire')).toBeVisible();
  await expect(page.locator("[class*='select-prochain-detenteur__single-value']")).toHaveText(
    /^Collecteur Pro 2 - /
  );

  // le parcours de la fiche se termine par le prochain destinataire, en attente de prise en charge
  const tracabilite = page.getByRole('group').filter({
    has: page.getByRole('heading', { name: 'Données de traçabilité' }),
  });
  await expect(tracabilite.getByText('Collecteur Pro 2', { exact: true })).toBeVisible();
  await expect(tracabilite.getByText('Transport des carcasses')).toBeVisible();
  await expect(tracabilite.getByText('En attente de prise en charge', { exact: true })).toBeVisible();
});
