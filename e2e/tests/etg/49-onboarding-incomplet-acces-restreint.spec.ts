import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test('ETG sans profil complet est redirigé vers onboarding coordonnées', async ({ page }) => {
  await connectWith(page, 'etg-nouveau@example.fr');
  await expect(page.getByRole('heading', { name: /Coordonnées/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Étape 1/i)).toBeVisible();
});
