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

test("Refus d'une carcasse avant transmission — ETG reçoit N-1", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();

  // Marquer une carcasse "retirée du circuit"
  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  const retirer = page.getByText(/retirée du circuit|refuser.*carcasse/i).first(); // TODO: verify selector
  await retirer.scrollIntoViewIfNeeded();
  await retirer.click();
  // Motif obligatoire ?
  const motif = page.getByRole("textbox", { name: /Motif|Commentaire/i }).first();
  if (await motif.count()) {
    await motif.fill("Test refus PD");
    await motif.blur();
  }
  const confirm = page.getByRole("button", { name: /Confirmer|Valider/i }).first();
  if (await confirm.count()) await confirm.click();
  const close = page.getByRole("listitem").filter({ hasText: "Fermer" }).getByRole("button");
  if (await close.count()) await close.click();

  // Transmettre
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const transmettre = page.getByRole("button", { name: "Transmettre" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // ETG 1 voit N-1 = 3
  await logoutAndConnect(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/Carcasses \(3\)/)).toBeVisible();
});
