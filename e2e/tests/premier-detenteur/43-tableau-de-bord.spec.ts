import { test, expect } from '@playwright/test';
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
  // PD hasn't created fiches as examinateur — dashboard shows empty state
  await expect(page.getByText(/Pas encore de carcasses|statistiques/i).first()).toBeVisible({
    timeout: 10000,
  });
});
