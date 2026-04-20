import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("88 - SVI d'un autre département : accès refusé à une fiche hors périmètre", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi-2@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  // App returns error page (Erreur 500 or access denied)
  const errorPage = page.getByText(/Erreur|introuvable|acc.s refus|non autoris/i).first();
  await expect(errorPage).toBeVisible({ timeout: 10000 });
});
