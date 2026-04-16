import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * Décider sur carcasse signalée comme manquante :
 * Dans le formulaire IPM1, l'option radio "Non, carcasse manquante" doit exister.
 * Cela correspond à sviIpm1PresenteeInspection=false + IPM1Decision.NON_RENSEIGNEE.
 */
test("86 - Option 'Non, carcasse manquante' disponible dans IPM1", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  const manquante = page.getByLabel("Non, carcasse manquante");
  await manquante.scrollIntoViewIfNeeded();
  await expect(manquante).toBeVisible();
  await manquante.check();

  // Remplir date
  await page.getByRole("button", { name: /Cliquez ici/ }).first().click();

  // Enregistrer — pas besoin de pièces/lésions car présentée=false
  page.once("dialog", (d) => d.accept());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  // TODO: verify outcome — expect no validation error, alert("IPM1 enregistrée") fires
});
