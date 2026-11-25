import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Collecteur profil vide redirigé vers onboarding', async ({ page }) => {
  await connectWith(page, 'collecteur-pro-nouveau@example.fr');
  await expect(
    page
      .getByRole('heading', { name: /Coordonnées/i })
      .or(page.getByText(/Merci pour votre inscription|Compléter votre profil|informations.*manquantes/i))
  ).toBeVisible({ timeout: 10000 });
});
