import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * Inspection refusée côté SVI : la décision de refus (saisie totale) relève d'IPM2.
 * IPM1 doit d'abord être en MISE_EN_CONSIGNE, puis IPM2 => SAISIE_TOTALE.
 *
 * Ce test vérifie le flow complet :
 * 1. IPM1 : sélectionner "Mise en consigne", remplir les champs obligatoires, enregistrer.
 * 2. Vérifier que la section IPM2 apparaît avec les options de décision.
 */
test("75 - SVI inspection : carcasse refusée (saisie totale via IPM2)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: /Daim.*MM-001-002/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();

  // IPM1 : "Mise en consigne" is the default decision
  await expect(page.getByLabel("Mise en consigne", { exact: true })).toBeChecked();

  // Date inspection
  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Fill pièces via multi-select
  await page.locator(".input-for-search-prefilled-data__input-container").first().click();
  await page.getByRole("option").first().click();

  // Fill lésions via multi-select
  await page.locator(".input-for-search-prefilled-data__input-container").nth(1).click();
  await page.getByRole("option").first().click();

  // Fill durée de consigne
  await page.getByLabel(/Durée de la consigne/).fill("24");
  await page.getByLabel(/Durée de la consigne/).blur();

  // Enregistrer IPM1
  page.once("dialog", (d) => d.accept());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // After IPM1 is saved with MISE_EN_CONSIGNE, IPM2 section should appear
  await expect(page.getByText(/Inspection Post-Mortem 2/)).toBeVisible({ timeout: 10000 });

  // Verify "Saisie totale" option is available in IPM2
  await expect(page.getByLabel("Saisie totale", { exact: true })).toBeVisible();
});
