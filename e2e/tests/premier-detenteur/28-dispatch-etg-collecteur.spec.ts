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

test("Dispatch mixte ETG + collecteur : chacun reçoit sa part", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // Groupe 1 : ETG 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const g1PasDeStockage = page.getByText("Pas de stockage").first();
  await g1PasDeStockage.scrollIntoViewIfNeeded();
  await g1PasDeStockage.click();
  const g1Transport = page.getByText("Je transporte les carcasses moi").first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  // Ajouter groupe 2
  const ajouter = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouter.scrollIntoViewIfNeeded();
  await ajouter.click();

  // Groupe 2 : collecteur
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Carcasses = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await g2Carcasses.nth(0).click();
  await g2Carcasses.nth(1).click();

  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /Collecteur.*1/i }).click(); // TODO: verify option label
  const g2Stockage = group2.getByText("Pas de stockage").first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText(/Le transport est réalisé par un collecteur/i).first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  const transmettre = page.getByRole("button", { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // ETG 1 ne voit que 2 carcasses
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (2)")).toBeVisible();

  // Collecteur ne voit que 2 carcasses
  await logoutAndConnect(page, "collecteur-pro-1@example.fr"); // TODO: verify email
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText("Carcasses (2)")).toBeVisible();
});
