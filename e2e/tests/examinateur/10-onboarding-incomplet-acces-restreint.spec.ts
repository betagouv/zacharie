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

test("Onboarding incomplet — redirigé vers mes-coordonnees + accès fiche bloqué", async ({ page }) => {
  // TODO: requires seed d'un user sans coordonnées. Ajouter dans populate-test-db.ts si absent.
  await connectWith(page, "examinateur-onboarding@example.fr");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-coordonnees/);

  // Tenter d'accéder à /chasseur
  await page.goto("http://localhost:3290/app/chasseur");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding/);

  // Tenter d'accéder à /chasseur/fei/XYZ
  await page.goto("http://localhost:3290/app/chasseur/fei/ZACH-FAKE");
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding/);
});
