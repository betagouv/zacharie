import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_FILTRES_RAPIDES');
});

test.use({ launchOptions: { slowMo: 100 } });

const FICHE_PIERRE_COLLECTEUR_1 = 'ZACH-20250707-QZ6E0-600001';
const FICHE_MARIE_DIRECT = 'ZACH-20250707-QZ6E0-600002';
const FICHE_MARIE_COLLECTEUR_2 = 'ZACH-20250707-QZ6E0-600003';

// Scenario 162 — un filtre enregistré dans le navigateur (session précédente, autre compte) dont la
// valeur ne correspond à aucune fiche de la liste : il n'a pas de case à cocher, il ne doit donc
// cacher aucune fiche.
test('ETG : un filtre enregistré qui ne correspond à aucune fiche ne cache pas les fiches', async ({
  page,
}) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  const fiche = (numero: string) => page.getByRole('link', { name: numero }).first();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible({ timeout: 10000 });

  await page.evaluate(() => {
    localStorage.setItem(
      'etg-fiches-filter-premier-detenteurs',
      JSON.stringify(['premier-detenteur-inconnu'])
    );
    localStorage.setItem('etg-fiches-filter-collecteurs', JSON.stringify(['collecteur-inconnu']));
    localStorage.setItem('etg-fiches-filter-ccgs', JSON.stringify(['ccg-inconnu']));
    localStorage.setItem('etg-fiches-filter-saisons', JSON.stringify([1990]));
  });
  await page.reload();

  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible({ timeout: 10000 });
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeVisible();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Réinitialiser' })).toBeHidden();

  // Cocher puis décocher un collecteur ne fait pas disparaître les autres fiches.
  await page.getByRole('button', { name: 'Collecteur', exact: true }).click();
  const collecteur1 = page.getByRole('checkbox', { name: 'Collecteur Pro 1' });
  await collecteur1.scrollIntoViewIfNeeded();
  await collecteur1.check();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible();
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeHidden();
  await collecteur1.uncheck();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible();
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeVisible();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeVisible();
});
