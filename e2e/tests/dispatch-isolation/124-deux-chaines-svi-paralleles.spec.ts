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

test.setTimeout(180_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("SVI 1 et SVI 2 voient chacun leur branche seulement", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. PD dispatches 2 carcasses to ETG 1 + 2 to ETG 2
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Select ETG 1 for group 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();

  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Add second recipient
  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  // Move 2 carcasses to group 2
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const group2CarcasseButtons = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await group2CarcasseButtons.nth(0).click();
  await group2CarcasseButtons.nth(1).click();

  const group1 = page.locator("div.rounded.border").first();
  await expect(group1.getByText("2 carcasse")).toBeVisible();
  await expect(group2.getByText("2 carcasse")).toBeVisible();

  // Select ETG 2 for group 2
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();

  const g2PasDeStockage = group2.getByText("Pas de stockage").first();
  await g2PasDeStockage.scrollIntoViewIfNeeded();
  await g2PasDeStockage.click();

  const g2Transport = group2.getByText("Je transporte les carcasses moi").first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  // Submit
  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // 2. ETG 1 takes charge + accepts carcasses + transmits to SVI
  await logoutAndConnect(page, "etg-1@example.fr");
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("heading", { name: /Cette fiche.*a été/ }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).not.toBeVisible({
    timeout: 10000,
  });
  await new Promise((r) => setTimeout(r, 500));

  // Accept first carcasse (Daim)
  await page.getByRole("button", { name: /Daim N° MM-001/ }).first().click();
  await page.getByText("Carcasse acceptée").first().click();
  // Wait for acceptance to register (button text changes to "accepté")
  await expect(page.getByRole("button", { name: /accepté/ }).first()).toBeVisible({ timeout: 5000 });

  // Accept second carcasse (Pigeons - it's a lot)
  await page.getByRole("button", { name: /Pigeons/ }).first().click();
  await page.getByText("Lot accepté").first().click();
  // Wait for acceptance to register
  await expect(page.getByRole("button", { name: /Pigeons.*accepté/ })).toBeVisible({ timeout: 10000 });

  // Select SVI 1 explicitly and transmit
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /SVI 1/ }).click();
  const transmettre1 = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettre1.scrollIntoViewIfNeeded();
  await transmettre1.click();
  await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 10000 });

  // 3. ETG 2 takes charge + accepts carcasses + transmits to SVI
  await logoutAndConnect(page, "etg-2@example.fr");
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("heading", { name: /Cette fiche.*a été/ }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).not.toBeVisible({
    timeout: 10000,
  });
  await new Promise((r) => setTimeout(r, 500));

  // Accept carcasses for ETG 2 (same pattern)
  await page.getByRole("button", { name: /Daim N° MM-001/ }).first().click();
  await page.getByText("Carcasse acceptée").first().click();
  await expect(page.getByRole("button", { name: /accepté/ }).first()).toBeVisible({ timeout: 5000 });

  const pigeonBtn2 = page.getByRole("button", { name: /Pigeons/ }).first();
  if (await pigeonBtn2.isVisible({ timeout: 2000 }).catch(() => false)) {
    await pigeonBtn2.click();
    await page.getByText("Lot accepté").first().click();
    await expect(page.getByRole("button", { name: /Pigeons.*accepté/ })).toBeVisible({ timeout: 10000 });
  }

  // Select SVI 2 explicitly and transmit
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /SVI 2/ }).click();
  const transmettre2 = page.getByRole("button", { name: "Transmettre la fiche" });
  await transmettre2.scrollIntoViewIfNeeded();
  await transmettre2.click();
  await expect(page.getByText(/SVI 2 a été notifié/)).toBeVisible({ timeout: 10000 });

  // 4. SVI 1 sees only 2 carcasses
  await logoutAndConnect(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/, { timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/Carcasses à inspecter \(2\)/)).toBeVisible({ timeout: 10000 });

  // 5. SVI 2 sees only 2 carcasses
  await logoutAndConnect(page, "svi-2@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/, { timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/Carcasses à inspecter \(2\)/)).toBeVisible({ timeout: 10000 });
});
