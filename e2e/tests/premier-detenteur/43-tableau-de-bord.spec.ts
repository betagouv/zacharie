import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Tableau de bord affiche MesChasses groupées", async ({ page }) => {
  await connectWith(page, "premier-detenteur@example.fr");
  await page.goto("http://localhost:3290/app/chasseur/tableau-de-bord");
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord/);
  await expect(page.getByRole("heading", { name: /Tableau de bord|Mes chasses/i }).first()).toBeVisible();
  // Au moins une fiche visible
  await expect(page.getByText(/ZACH-/).first()).toBeVisible();
});
