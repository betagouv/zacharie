import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("COLLECTEUR_PRO");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 73 — Hors-ligne : prise en charge locale → sync au retour en ligne.
test("Collecteur transmet hors-ligne puis sync online", async ({ page, context }) => {
  const feiId = "ZACH-20250707-QZ6E0-175242";
  await connectWith(page, "collecteur-pro@example.fr");
  await page.getByRole("link", { name: new RegExp(feiId) }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();

  await context.setOffline(true);

  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /ETG 1/ }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();

  await context.setOffline(false);
  await expect(page.getByText(/ETG 1 a été notifié/)).toBeVisible({ timeout: 15000 });
});
