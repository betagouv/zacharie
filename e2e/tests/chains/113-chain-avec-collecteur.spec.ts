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
  test.setTimeout(120_000);
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
  // No transport step when dispatching to a collecteur — they handle transport
  const transmettreBtn1 = page.getByRole("button", { name: "Transmettre" });
  await transmettreBtn1.scrollIntoViewIfNeeded();
  await transmettreBtn1.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. Collecteur Pro prend en charge + transmet a ETG 1
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await page.getByRole("link", { name: feiId }).click();
  // Collecteur button text is different from ETG
  await page.getByRole("button", { name: /Je contrôle et transporte les carcasses/ }).click();
  // Set date
  await page.getByRole("button", { name: /Cliquez ici pour définir/ }).click();
  // Select ETG
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /ETG 1/ }).click();
  // Storage
  const pasDeStockage2 = page.getByText("Pas de stockage").first();
  await pasDeStockage2.scrollIntoViewIfNeeded();
  await pasDeStockage2.click();
  // Transmit
  const transmettre = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1.*notifié|fiche.*transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 3. ETG 1 prend en charge + transmet au SVI
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));
  // Accept first carcasse
  await page.getByRole("button", { name: /Daim N° MM-/ }).first().click();
  await page.getByLabel(/Daim - N° MM-/).getByText("Carcasse acceptée").first().click();
  await expect(page.getByRole("button", { name: /Daim N° MM-/ }).first()).toBeVisible();
  // Set date + select SVI
  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "SVI 1 - 75000 Paris (Service" }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

  // 4. SVI voit la fiche
  await logoutAndConnect(page, "svi@example.fr");
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 15000 });
});
