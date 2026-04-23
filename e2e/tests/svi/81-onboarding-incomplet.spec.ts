import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('81 - SVI avec onboarding incomplet : détecte profil incomplet', async ({ page }) => {
  await connectWith(page, 'svi-nouveau@example.fr');
  // Either redirected to onboarding or shows completion/coordonnées form
  await expect(
    page
      .getByRole('heading', { name: /Coordonnées/i })
      .or(page.getByText(/Merci pour votre inscription|Compléter votre profil|informations.*manquantes/i))
  ).toBeVisible({ timeout: 10000 });
});
