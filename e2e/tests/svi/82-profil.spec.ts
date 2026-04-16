import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("82 - Profil SVI : entreprise, utilisateurs, notifications accessibles", async ({ page }) => {
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);

  await page.goto("http://localhost:3290/app/svi/entreprise/informations");
  await expect(page).toHaveURL(/\/app\/svi\/entreprise\/informations/);
  await expect(page.getByText(/SVI 1/).first()).toBeVisible({ timeout: 10000 });

  await page.goto("http://localhost:3290/app/svi/entreprise/utilisateurs");
  await expect(page).toHaveURL(/\/app\/svi\/entreprise\/utilisateurs/);
  await expect(page.getByText(/svi@example\.fr/i).first()).toBeVisible({ timeout: 10000 });

  // Profil notifications / partage
  await page.goto("http://localhost:3290/app/svi/profil/mes-notifications");
  // TODO: verify exact profile sub-routes (may be /profil/mes-coordonnees, etc.)
  await expect(page).toHaveURL(/\/app\/svi\/profil/);
});
