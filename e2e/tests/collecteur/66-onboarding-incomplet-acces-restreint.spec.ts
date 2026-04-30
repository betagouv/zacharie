import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 66 — Onboarding incomplet : collecteur sans profil complet → onboarding ou message complétion.
test('Collecteur profil vide redirigé vers onboarding', async ({ page }) => {
  await connectWith(page, 'collecteur-pro-nouveau@example.fr');
  // Either redirected to onboarding or shows completion message
  await expect(
    page
      .getByRole('heading', { name: /Coordonnées/i })
      .or(page.getByText(/Merci pour votre inscription|Compléter votre profil|informations.*manquantes/i))
  ).toBeVisible({ timeout: 10000 });
});
