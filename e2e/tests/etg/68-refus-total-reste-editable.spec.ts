import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 68 — Refus total côté ETG ≠ fiche verrouillée.
// Quand l'ETG refuse TOUTES ses carcasses, la fiche n'est PAS clôturée pour autant : seul le SVI
// (clôture manuelle ou cron) verrouille la fiche. Tant que le SVI n'a pas clôturé, l'ETG doit
// pouvoir rouvrir une carcasse et corriger sa décision (ex. ré-accepter une carcasse refusée).
//
// Garde-fou: le verrou `canEdit` doit se baser sur `isCarcasseClosedBySvi` (clôture SVI), PAS sur
// `isCarcasseDone` (qui inclut les refus intermédiaires). Si quelqu'un re-élargit le verrou à
// `isCarcasseDone`, la modale se ferme dès le dernier refus et ce test échoue — alors que les
// autres tests de refus (115) resteraient verts.

test.beforeEach(async () => {
  await resetDb('ETG');
});
test.use({ launchOptions: { slowMo: 100 } });

test('ETG refuse toutes les carcasses → la fiche reste éditable (pas de verrou avant le SVI)', async ({
  page,
}) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-165242';

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
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
  // après ce refus, toutes mes carcasses sont "done". Sur main, canEdit ne verrouille pas pour
  // autant (le SVI n'a rien clôturé), donc la modale reste ouvrable.
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByText('Lot refusé').click();
  await page
    .getByLabel('Pigeons - N° MM-001-')
    .locator('.input-for-search-prefilled-data__input-container')
    .click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(
    page.getByRole('button', { name: /Pigeons \(10\) N° MM-001-003.*Refusé par ETG 1/ })
  ).toBeVisible();

  // Toutes les carcasses sont refusées. La fiche NE DOIT PAS être verrouillée : on rouvre le
  // premier daim et on le ré-accepte. Si le verrou s'était déclenché (régression), la modale ne
  // s'ouvrirait pas / le radio serait désactivé et ce clic échouerait.
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();

  // La décision a bien été modifiée → preuve que la fiche est restée éditable après le refus total.
  await expect(
    page.getByRole('button', { name: /Daim N° MM-001-001 Mise à mort.*Acceptée par ETG 1/ })
  ).toBeVisible();
});
