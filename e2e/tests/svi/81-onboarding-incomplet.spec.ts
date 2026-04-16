import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("81 - SVI avec onboarding incomplet : redirigé vers /app/svi/onboarding", async ({ page }) => {
  await connectWith(page, "svi-nouveau@example.fr");
  // Empty profile (pas de coordonnées) → layout SVI redirige vers onboarding
  await expect(page).toHaveURL(/\/app\/svi\/onboarding/, { timeout: 10000 });

  // Vérifie que l'accès direct aux fiches renvoie au profil/onboarding
  await page.goto("http://localhost:3290/app/svi");
  await expect(page).toHaveURL(/\/app\/svi\/onboarding|\/app\/svi\/profil/, { timeout: 10000 });
  // TODO: verify exact redirect target (onboarding vs profil) after onboarding refactor
});
