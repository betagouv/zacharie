import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("74 - SVI inspection : carcasse acceptée (IPM1 ACCEPTE)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);

  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // Open first carcasse card (Daim MM-001-001)
  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Fill IPM1 with "Acceptée" (no lesions required)
  await expect(page.getByText(/Inspection Post-Mortem 1/)).toBeVisible();

  // Date inspection : quick fill
  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Select "Acceptée" decision
  const acceptedRadio = page.getByLabel("Acceptée", { exact: true });
  await acceptedRadio.scrollIntoViewIfNeeded();
  await acceptedRadio.check();

  // Enregistrer
  page.once("dialog", (d) => d.accept()); // alert('IPM1 enregistrée')
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // Go back to fiche and assert status reflects "accepté"
  await page.getByRole("button", { name: "Retour" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText(/accepté/i).first()).toBeVisible({ timeout: 10000 });
});
