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
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: feiId }).click();

  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Select "Non, carcasse manquante" — first one is in IPM1, second in IPM2
  const manquante = page.getByLabel("Non, carcasse manquante").first();
  await manquante.scrollIntoViewIfNeeded();
  await expect(manquante).toBeVisible();
  await manquante.check({ force: true });

  // Set date
  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Enregistrer — no pièces/lésions required when not presented
  page.once("dialog", (d) => d.accept());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // No validation error — alert fires
  await expect(
    page.getByText(/Il manque les pièces|Il manque les lésions/i),
  ).toHaveCount(0, { timeout: 5000 });
});
