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
  await resetDb("PREMIER_DETENTEUR");
});

test("PD sans coordonnées → redirigé onboarding, pas d'accès aux fiches", async ({ page }) => {
  // TODO: requires seed user PD sans coordonnées
  await connectWith(page, "premier-detenteur-onboarding@example.fr");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding/);

  await page.goto("http://localhost:3290/app/chasseur");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding/);

  await page.goto("http://localhost:3290/app/chasseur/fei/ZACH-20250707-QZ6E0-155242");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding/);
});
