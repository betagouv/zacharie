import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("COLLECTEUR_PRO");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 65 — Refus carcasse en collecte avant transmission ETG.
test.skip("Collecteur refuse une carcasse puis transmet à ETG", async ({ page }) => {
  // SKIP: collecteur carcasse refusal UX unknown — need user input
  const feiId = "ZACH-20250707-QZ6E0-175242";
  await connectWith(page, "collecteur-pro@example.fr");
  await page.getByRole("link", { name: new RegExp(feiId) }).click();

  await page.getByRole("button", { name: /Je contrôle et transporte les carcasses|Prendre en charge/ }).click();
  await new Promise((r) => setTimeout(r, 500)); // DSFR modal settle

  await page.getByRole("button", { name: "Daim N° MM-001-002 Mise à" }).click();
  await page.getByLabel("Daim - N° MM-001-002").getByText("Carcasse refusée").click();
  await page.locator(".input-for-search-prefilled-data__input-container").click();
  await page.getByRole("option", { name: "Présence de souillures" }).click();
  await page.getByRole("textbox", { name: "Votre commentaire Un" }).fill("Refus collecteur");
  await page.getByLabel("Daim - N° MM-001-002").getByRole("button", { name: "Enregistrer" }).click();

  await expect(page.getByText(/Refus de 1 carcasse/)).toBeVisible({ timeout: 5000 });

  await page.getByRole("button", { name: "Cliquez ici pour définir" }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: /ETG 1/ }).click();
  await page.getByRole("button", { name: "Transmettre la fiche" }).click();
  await expect(page.getByText(/ETG 1 a été notifié/)).toBeVisible({ timeout: 5000 });
});
