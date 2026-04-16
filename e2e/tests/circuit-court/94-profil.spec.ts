import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

test("94 - Profil circuit court : coordonnées, entreprise, utilisateurs accessibles", async ({ page }) => {
  await connectWith(page, "commerce-de-detail@example.fr");
  await expect(page).toHaveURL(/\/app\/circuit-court/);

  await page.goto("http://localhost:3290/app/circuit-court/entreprise/informations");
  await expect(page).toHaveURL(/\/app\/circuit-court\/entreprise\/informations/);
  await expect(page.getByText(/Commerce de Détail 1/i).first()).toBeVisible({ timeout: 10000 });

  await page.goto("http://localhost:3290/app/circuit-court/entreprise/utilisateurs");
  await expect(page).toHaveURL(/\/app\/circuit-court\/entreprise\/utilisateurs/);
  await expect(page.getByText(/commerce-de-detail@example\.fr/i).first()).toBeVisible({ timeout: 10000 });

  // Profil (mes coordonnées / notifications)
  await page.goto("http://localhost:3290/app/circuit-court/profil/mes-coordonnees");
  // TODO: verify exact profil sub-route
  await expect(page).toHaveURL(/\/app\/circuit-court\/profil/);
});
