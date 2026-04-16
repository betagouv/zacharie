import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 49 — Onboarding incomplet : accès restreint
// etg-nouveau a un profil vide → doit être redirigé vers l'onboarding.
test("ETG sans entreprise redirigé vers onboarding", async ({ page }) => {
  await connectWith(page, "etg-nouveau@example.fr");
  // Après connexion, redirection vers /app/etg/onboarding/...
  await expect(page).toHaveURL(/\/app\/etg\/onboarding\//, { timeout: 10000 });

  // Tentative d'accès direct à la liste des fiches → redirigé vers onboarding.
  await page.goto("http://localhost:3290/app/etg");
  await expect(page).toHaveURL(/\/app\/etg\/onboarding\//, { timeout: 10000 });
});
