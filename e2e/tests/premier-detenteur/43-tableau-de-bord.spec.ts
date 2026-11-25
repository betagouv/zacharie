import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Tableau de bord affiche MesChasses groupées', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/chasseur/tableau-de-bord');
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord/);
  await expect(page.getByText(/Pas encore de carcasses|statistiques/i).first()).toBeVisible({
    timeout: 10000,
  });
});

test('Empty dashboard — chasseur sans CFEI ne voit pas le bouton « Créer une fiche »', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/tableau-de-bord');
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord/);

  await expect(page.getByText('Pas encore de carcasses cette saison')).toBeVisible({ timeout: 10000 });
  await expect(
    page.getByText('Vos statistiques apparaîtront ici dès que vos premières carcasses seront enregistrées.')
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer une fiche' })).toHaveCount(0);

  const bottomNav = page.locator('#bottom-navigation');
  await expect(bottomNav).toBeVisible();
  await expect(bottomNav.getByText('Nouvelle fiche')).toHaveCount(0);
});
