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

  // Open first carcasse card (Daim MM-001-001) — navigates to carcasse-svi page
  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Fill IPM1 — "Acceptée" does NOT require pièces/lésions
  // Date inspection : quick fill
  const dateShortcut = page.getByRole("button", { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();

  // Select "Acceptée" decision — use locator within the IPM1 fieldset
  const ipm1Decision = page.locator("fieldset").filter({ hasText: "Décision IPM1" }).first();
  await ipm1Decision.scrollIntoViewIfNeeded();
  await ipm1Decision.getByLabel(/Acceptée/).check({ force: true });

  // Enregistrer — triggers alert('IPM1 enregistrée')
  page.once("dialog", (d) => d.accept());
  const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();

  // After saving, alert was accepted. Navigate back to fiche.
  await page.getByText("Fiches").first().click();
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole("link", { name: feiId }).click();

  // Carcasse should now show "accepté" status
  await expect(page.getByText(/accepté/i).first()).toBeVisible({ timeout: 10000 });
});
