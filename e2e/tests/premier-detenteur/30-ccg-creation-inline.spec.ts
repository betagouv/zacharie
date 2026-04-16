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

test("Création CCG inline depuis le formulaire de transmission", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();

  await page.getByText("Carcasses déposées dans un Centre").click();
  await page.getByRole("button", { name: "Renseigner ma chambre froide" }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole("textbox", { name: "Numéro d'identification" }).fill("CCG-INLINE");
  await page.getByRole("button", { name: "Ajouter cette chambre froide" }).click();

  await expect(page.getByText(/CCG-INLINE/)).toBeVisible();

  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  const transmettre = page.getByRole("button", { name: "Transmettre" });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
});
