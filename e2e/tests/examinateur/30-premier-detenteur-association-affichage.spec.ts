import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const ASSOCIATION_ID = '5b916331-632e-4c29-be2e-12a834e92688'; // Association de chasseurs (populate-test-db)

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

// Quand le Premier Détenteur est une association, on enregistre aussi `premier_detenteur_user_id`
// (l'utilisateur qui agit au nom de l'association). Le select doit continuer d'afficher l'association,
// jamais « Vous » — y compris après le remount provoqué par la validation, et après rechargement.
test('Examinateur → Association : le select affiche l’association après « Continuer »', async ({ page }) => {
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  const selectBloc = page.locator('#select-next-owner');
  const select = selectBloc.locator('select[name="next_owner"]');

  await page.getByRole('button', { name: /Association de chasseurs/i }).click();
  await expect(select).toHaveValue(ASSOCIATION_ID);

  await selectBloc.getByRole('button', { name: 'Continuer' }).click();

  // Le bloc a été revalidé : plus de bouton « Continuer » ici, et l'association reste sélectionnée.
  await expect(selectBloc.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
  await expect(select).toHaveValue(ASSOCIATION_ID);
  await expect(select.locator('option:checked')).toHaveText(/Association de chasseurs/i);
  await expect(select.locator('option:checked')).not.toHaveText(/Vous/i);

  // Et après rechargement (état relu depuis la fiche synchronisée).
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);
  await expect(select).toHaveValue(ASSOCIATION_ID);
  await expect(select.locator('option:checked')).not.toHaveText(/Vous/i);
});

// Contre-épreuve : quand l'examinateur se désigne lui-même Premier Détenteur, c'est bien « Vous » qui
// reste affiché (le fix ne doit pas inverser le cas nominal).
test('Examinateur → lui-même : le select affiche « Vous » après « Continuer »', async ({ page }) => {
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de mise à mort' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  const selectBloc = page.locator('#select-next-owner');
  const select = selectBloc.locator('select[name="next_owner"]');

  // « Pierre Petit » = l'utilisateur connecté ; l'API l'ajoute lui-même aux détenteurs initiaux.
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await selectBloc.getByRole('button', { name: 'Continuer' }).click();

  await expect(selectBloc.getByRole('button', { name: 'Continuer' })).toHaveCount(0);
  await expect(select.locator('option:checked')).toHaveText(/^Vous \(/);
});
