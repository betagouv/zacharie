import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 49 — Onboarding incomplet : accès restreint
// etg-nouveau has empty profile → sees deactivated/onboarding message, not the fiches list
test('ETG sans profil complet est redirigé vers onboarding coordonnées', async ({ page }) => {
  await connectWith(page, 'etg-nouveau@example.fr');
  // ETG with empty profile is redirected to onboarding step 1 (Coordonnées)
  await expect(page.getByRole('heading', { name: /Coordonnées/i })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/Étape 1/i)).toBeVisible();
});
