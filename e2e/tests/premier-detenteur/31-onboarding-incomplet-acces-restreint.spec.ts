import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("PD sans coordonnées → ChasseurDeactivated affiché, pas d'accès aux fiches", async ({ page }) => {
  // premier-detenteur-onboarding@example.fr has no prenom/nom/address — profile incomplete
  await connectWith(page, 'premier-detenteur-onboarding@example.fr');

  // The gate shows ChasseurDeactivated instead of redirecting to onboarding
  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });

  // Attempting to access a fiche still shows the deactivated content
  await page.goto('http://localhost:3290/app/chasseur/fei/ZACH-20250707-QZ6E0-155242');
  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });
});
