import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 113 — Chain avec collecteur : PD → collecteur → ETG → SVI.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Chain : PD → collecteur → ETG → SVI", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. PD transmet au Collecteur Pro 1
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /Collecteur Pro 1/i }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  await page.getByRole("button", { name: "Transmettre" }).click();
  await expect(page.getByText(/Collecteur Pro 1.*a été notifi/i)).toBeVisible({ timeout: 15000 });

  // 2. Collecteur Pro prend en charge + transmet à ETG 1
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: /Prendre en charge/i }).first().click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  await page.getByRole("button", { name: /Transmettre/i }).first().click();
  await expect(page.getByText(/ETG 1.*a été notifi/i)).toBeVisible({ timeout: 15000 });

  // 3. ETG 1 prend en charge + transmet au SVI
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  // Accepter rapidement la 1ère carcasse pour satisfaire l'UI
  const daimBtn = page.getByRole("button", { name: /Daim N° MM-/ }).first();
  await daimBtn.scrollIntoViewIfNeeded();
  await daimBtn.click();
  const accept = page.getByText("Carcasse acceptée").first();
  if (await accept.isVisible().catch(() => false)) await accept.click();
  await page.keyboard.press("Escape").catch(() => void 0);
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris (Service" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

  // 4. SVI voit la fiche
  await logoutAndConnect(page, "svi@example.fr");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 15000 });
});
