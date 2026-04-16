import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Dispatch avec un groupe vide — validation empêche transmission", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Ajouter groupe 2 sans lui assigner de carcasse
  const ajouter = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouter.scrollIntoViewIfNeeded();
  await ajouter.click();

  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();

  // Laisser le groupe 2 vide et tenter Transmettre
  const transmettre = page.getByRole("button", { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  // Attendre une validation bloquante : soit message d'erreur, soit bouton resté disabled
  const notifVisible = await page.getByText(/Votre fiche a été transmise/i).first().isVisible().catch(() => false);
  expect(notifVisible).toBe(false);
  await expect(page.getByText(/groupe.*vide|0 carcasse|sélectionner.*carcasse/i).first()).toBeVisible();
});
