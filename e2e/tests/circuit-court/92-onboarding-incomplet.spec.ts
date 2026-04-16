import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

test("92 - Onboarding incomplet circuit-court : redirection vers onboarding", async ({ page }) => {
  await connectWith(page, "commerce-de-detail-nouveau@example.fr");
  await expect(page).toHaveURL(/\/app\/circuit-court\/onboarding/, { timeout: 10000 });

  // Accès direct à la liste refusé tant que onboarding pas complété
  await page.goto("http://localhost:3290/app/circuit-court");
  await expect(page).toHaveURL(/\/app\/circuit-court\/onboarding|\/app\/circuit-court\/profil/, {
    timeout: 10000,
  });
});
