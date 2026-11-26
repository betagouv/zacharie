import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Pages profil collecteur accessibles et persistées', async ({ page }) => {
  await connectWith(page, 'collecteur-pro@example.fr');

  await page.goto('http://localhost:3290/app/collecteur/entreprise/informations');
  await expect(page).toHaveURL(/\/app\/collecteur\/entreprise\/informations/);

  await page.goto('http://localhost:3290/app/collecteur/entreprise/utilisateurs');
  await expect(page).toHaveURL(/\/app\/collecteur\/entreprise\/utilisateurs/);
  await expect(page.getByText('collecteur-pro-nouveau@example.fr').first()).toBeVisible({ timeout: 10000 });

  await page.goto('http://localhost:3290/app/collecteur/profil/notifications');
  await expect(page).toHaveURL(/\/app\/collecteur\/profil\/notifications/);

  await page.goto('http://localhost:3290/app/collecteur/profil/partage-de-mes-donnees');
  await expect(page).toHaveURL(/\/app\/collecteur\/profil\/partage-de-mes-donnees/);
});
