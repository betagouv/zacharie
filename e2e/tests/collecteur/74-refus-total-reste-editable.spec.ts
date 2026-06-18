import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 74 — Refus total côté collecteur ≠ fiche verrouillée (miroir du 68 côté ETG).
// Quand le collecteur refuse TOUTES ses carcasses, la fiche n'est PAS clôturée pour autant : seul le
// SVI (clôture manuelle ou cron) verrouille la fiche. Tant que le SVI n'a pas clôturé, le collecteur
// doit pouvoir rouvrir une carcasse et corriger sa décision (ex. ré-accepter une carcasse refusée).
//
// Garde-fou: `effectiveCanEdit` se base sur `isCarcasseDone` (verrou prise en charge / transmission),
// MAIS la modale de décision utilise `canEditCarcasseDecision` qui ignore ce verrou. Si quelqu'un
// passe la décision sur `effectiveCanEdit`, la modale se ferme dès le dernier refus et ce test échoue.

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});
test.use({ launchOptions: { slowMo: 100 } });

test('Collecteur refuse toutes les carcasses → la fiche reste éditable (pas de verrou avant le SVI)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-175242';

  await connectWith(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');
  await page.getByRole('link', { name: new RegExp(feiId) }).click();
  await page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));

  const refuseGrandGibier = async (bracelet: string) => {
    await page.getByRole('button', { name: `Daim N° ${bracelet} Mise à` }).click();
    await page.getByLabel(`Daim - N° ${bracelet}`).getByText('Carcasse refusée').click();
    await page
      .getByLabel(`Daim - N° ${bracelet}`)
      .locator('.input-for-search-prefilled-data__input-container')
      .click();
    await page.getByRole('option', { name: 'Présence de souillures' }).click();
    await page.getByLabel(`Daim - N° ${bracelet}`).getByRole('button', { name: 'Enregistrer' }).click();
    await expect(page.getByRole('button', { name: `Daim N° ${bracelet} Mise à` })).toBeVisible();
  };

  // Refuse les 3 daims
  await refuseGrandGibier('MM-001-001');
  await refuseGrandGibier('MM-001-002');
  await refuseGrandGibier('MM-001-004');

  // Refuse le lot de pigeons (petit gibier → "Lot refusé") — c'est la DERNIÈRE carcasse :
  // après ce refus, toutes mes carcasses sont "done". Le verrou ne doit PAS se déclencher
  // (le SVI n'a rien clôturé), donc la modale reste ouvrable.
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByText('Lot refusé').click();
  await page
    .getByLabel('Pigeons - N° MM-001-')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('button', { name: /Pigeons \(10\) N° MM-001-003.*Refusé par Collecteur Pro 1/ })
  ).toBeVisible();

  // Toutes les carcasses sont refusées. La fiche NE DOIT PAS être verrouillée : on rouvre le
  // premier daim et on le ré-accepte. Si le verrou s'était déclenché (régression), la modale ne
  // s'ouvrirait pas / le radio serait désactivé et ce clic échouerait.
  await page.getByRole('button', { name: /Daim N° MM-001-001 Mise à.*Refusée par Collecteur Pro 1/ }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();

  // La décision a bien été modifiée → le daim n'est plus affiché comme refusé : preuve que la fiche
  // est restée éditable après le refus total.
  await expect(
    page.getByRole('button', { name: /Daim N° MM-001-001 Mise à.*Refusée par Collecteur Pro 1/ })
  ).not.toBeVisible();
});
