import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test('92 - Onboarding incomplet circuit-court : profil incomplet détecté', async ({ page }) => {
  await connectWith(page, 'commerce-de-detail-nouveau@example.fr');
  // Either redirected to onboarding or shows completion message or onboarding form
  await expect(
    page
      .getByRole('heading', { name: /Coordonnées/i })
      .or(page.getByText(/Merci pour votre inscription|Compléter votre profil|informations.*manquantes/i))
  ).toBeVisible({ timeout: 10000 });
});
