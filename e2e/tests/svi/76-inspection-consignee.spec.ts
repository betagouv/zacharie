import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * Inspection : mise en consigne (IPM1 MISE_EN_CONSIGNE).
 * On vérifie que les champs obligatoires (durée, pièces, lésions) apparaissent
 * et que la section IPM1 est bien ouverte pour édition.
 */
test("76 - SVI inspection : carcasse consignée (IPM1 MISE_EN_CONSIGNE)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();

  // Mise en consigne is the default decision; durée de consigne appears
  await expect(page.getByLabel("Mise en consigne", { exact: true })).toBeChecked();
  await expect(page.getByText(/Durée de la consigne/)).toBeVisible();

  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Fill durée
  await page.getByLabel(/Durée de la consigne/).fill("24");
  await page.getByLabel(/Durée de la consigne/).blur();

  // Try save; missing pieces/lesions should block
  page.once("dialog", (d) => d.dismiss());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await expect(page.getByText(/Il manque (les pièces|les lésions)/i)).toBeVisible({ timeout: 10000 });
});
