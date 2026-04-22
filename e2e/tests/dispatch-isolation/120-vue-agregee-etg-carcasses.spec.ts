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

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("/etg/carcasses ne montre que les carcasses dispatchées à cet ETG", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. PD takes charge and dispatches 2 ETG x 2 carcasses
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

  // 2. Login as ETG 1, take charge, then check carcasses page
  await logoutAndConnect(page, "etg-1@example.fr");
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (2)")).toBeVisible({ timeout: 10000 });

  // Take charge
  await page.getByRole("heading", { name: /Cette fiche.*a été/ }).click();
  const priseEnChargeBtn = page.getByRole("button", { name: "Prendre en charge les carcasses" });
  await expect(priseEnChargeBtn).toBeVisible();
  await priseEnChargeBtn.click();
  await expect(priseEnChargeBtn).not.toBeVisible({ timeout: 10000 });

  // Now go to /app/etg/carcasses and check only 2 are visible
  await page.goto("http://localhost:3290/app/etg/carcasses");
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/, { timeout: 10000 });

  // Wait for carcasses to load and verify count shows 2
  await expect(page.getByText("Total: 2")).toBeVisible({ timeout: 15000 });
});
