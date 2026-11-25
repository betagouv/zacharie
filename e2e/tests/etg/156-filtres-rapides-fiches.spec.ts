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

test('ETG : les filtres rapides collecteur et premier détenteur gardent les bonnes fiches', async ({
  page,
}) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/carcasses');

  const fiche = (numero: string) => page.getByRole('link', { name: numero }).first();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible({ timeout: 10000 });
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeVisible();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeVisible();

  await page.getByRole('button', { name: 'Collecteur', exact: true }).click();
  const collecteur1 = page.getByRole('checkbox', { name: 'Collecteur Pro 1' });
  await collecteur1.scrollIntoViewIfNeeded();
  await collecteur1.check();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeVisible();
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeHidden();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeHidden();
  await collecteur1.uncheck();

  await page.getByRole('button', { name: 'Premier détenteur', exact: true }).click();
  const marie = page.getByRole('checkbox', { name: 'Marie Martin' });
  await marie.scrollIntoViewIfNeeded();
  await marie.check();
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeVisible();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeVisible();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeHidden();

  await collecteur1.scrollIntoViewIfNeeded();
  await collecteur1.check();
  await expect(fiche(FICHE_PIERRE_COLLECTEUR_1)).toBeHidden();
  await expect(fiche(FICHE_MARIE_DIRECT)).toBeHidden();
  await expect(fiche(FICHE_MARIE_COLLECTEUR_2)).toBeHidden();
});
