import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("COLLECTEUR_PRO");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 66 — Onboarding incomplet : collecteur sans entreprise → redirigé onboarding.
test("Collecteur profil vide redirigé vers onboarding", async ({ page }) => {
  await connectWith(page, "collecteur-pro-nouveau@example.fr");
  await expect(page).toHaveURL(/\/app\/collecteur\/onboarding\//, { timeout: 10000 });

  await page.goto("http://localhost:3290/app/collecteur");
  await expect(page).toHaveURL(/\/app\/collecteur\/onboarding\//, { timeout: 10000 });
});
