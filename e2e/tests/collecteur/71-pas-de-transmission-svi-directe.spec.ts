import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("COLLECTEUR_PRO");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 71 — Collecteur ne peut pas transmettre au SVI directement.
// La liste des détenteurs ne doit proposer que des ETG (pas de SVI).
test("Collecteur : le dropdown prochain détenteur n'inclut pas de SVI", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-175242";
  await connectWith(page, "collecteur-pro@example.fr");
  await page.getByRole("link", { name: new RegExp(feiId) }).click();
  await page.getByRole("button", { name: /Je contrôle et transporte les carcasses|Prendre en charge/ }).click();

  await page.getByRole("button", { name: /Cliquez ici pour définir/ }).click();

  const selectContainer = page.locator("[class*='select-prochain-detenteur'][class*='input-container']");
  await selectContainer.scrollIntoViewIfNeeded();
  await selectContainer.click();

  // Aucune option SVI.
  await expect(page.getByRole("option", { name: /^SVI / })).toHaveCount(0);
  // Au moins une option ETG.
  await expect(page.getByRole("option", { name: /^ETG / }).first()).toBeVisible();
});
