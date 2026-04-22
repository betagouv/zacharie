import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("PD supprime une carcasse avant transmission — ETG reçoit N-1", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  // Wait for fiche to appear in the list (local-first sync)
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();

  // 1. PD takes charge
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // 2. Delete a carcasse via trash icon
  const trashIcons = page.getByTitle("Supprimer la carcasse");
  await expect(trashIcons.first()).toBeVisible({ timeout: 10000 });

  // Handle window.confirm dialog
  page.once("dialog", (dialog) => dialog.accept());
  await trashIcons.first().click();

  // Wait for deletion to take effect
  await expect(trashIcons).toHaveCount(3, { timeout: 10000 });

  // 3. Dispatch remaining 3 carcasses to ETG 1
  const selectDest = page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first();
  await selectDest.scrollIntoViewIfNeeded();
  await selectDest.click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();

  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // 4. Transmettre
  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // 5. Login as ETG 1 and verify only 3 carcasses (not 4)
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (3)")).toBeVisible({ timeout: 10000 });
});
