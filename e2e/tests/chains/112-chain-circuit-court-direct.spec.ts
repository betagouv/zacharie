import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 112 — Chain circuit court direct : examinateur (déjà fait via seed PD) → PD → Commerce de détail.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Chain circuit court : PD → Commerce de détail (sans ETG)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. PD prend en charge + transmet directement au commerce de détail
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  // Sélectionner un commerce de détail comme destinataire
  await page.getByRole("option", { name: /Commerce de Détail/i }).first().click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const transmettreBtn = page.getByRole("button", { name: "Transmettre" });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/a été notifi/i).first()).toBeVisible({ timeout: 15000 });

  // 2. Commerce de détail reçoit
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "commerce-de-detail@example.fr");
  await expect(page).toHaveURL(/\/app\/circuit-court/);
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 15000 });
});
