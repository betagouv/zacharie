import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("85 - SVI tente d'enregistrer IPM1 MISE_EN_CONSIGNE sans motif/lésions : bloqué UI", async ({
  page,
}) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: feiId }).click();

  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Date seulement
  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Default decision is "Mise en consigne" — try to save without pièces/lésions/durée
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // Validation error should appear (missing pièces or lésions or durée)
  await expect(
    page.getByText(/Il manque les pièces inspectées|Il manque les lésions|Il manque la durée/i).first(),
  ).toBeVisible({ timeout: 10000 });
});
