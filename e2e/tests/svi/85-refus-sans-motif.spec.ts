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
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Date seulement
  await page.getByRole("button", { name: /Cliquez ici/ }).first().click();

  // Tenter d'enregistrer sans pièces/lésions
  page.once("dialog", (d) => d.dismiss());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // Alert d'erreur visible (IPM1 validation requires pièces or lésions)
  await expect(
    page.getByText(/Il manque les pièces inspectées|Il manque les lésions/i).first()
  ).toBeVisible({ timeout: 10000 });
});
