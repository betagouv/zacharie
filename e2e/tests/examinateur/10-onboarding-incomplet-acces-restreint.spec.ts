import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Onboarding incomplet — ChasseurDeactivated affiché, accès fiche bloqué", async ({ page }) => {
  await connectWith(page, "examinateur-onboarding@example.fr");

  // The gate does NOT redirect to onboarding — it shows ChasseurDeactivated on /app/chasseur
  await page.goto("http://localhost:3290/app/chasseur");

  // ChasseurDeactivated shows "compléter votre profil" when profile fields are missing
  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });

  // Attempting to access a fiche still shows the deactivated content
  await page.goto("http://localhost:3290/app/chasseur/fei/ZACH-FAKE");
  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });
});
