import { test, expect } from "@playwright/test";
import { resetDb } from "../scripts/reset-db";
import { connectWith } from "../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Dispatch 4 carcasses vers 2 destinataires ETG", async ({ page, context }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";

  // 1. Premier détenteur prend en charge
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/tableau-de-bord");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("heading", { name: "🫵 Cette fiche vous a été" }).click();
  await expect(page.getByRole("button", { name: "Je prends en charge cette" })).toBeVisible();
  await page.getByRole("button", { name: "Je prends en charge cette" }).click();
  await expect(page.getByText("Étape suivante : Transport")).toBeVisible({ timeout: 10000 });

  // 2. Sélectionner ETG 1 pour le groupe 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole("option", { name: "ETG 1 - 75000 Paris (" }).click();

  // Sélectionner "Pas de stockage"
  const pasDeStockage = page.getByText("Pas de stockage").first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();

  // Sélectionner transport
  const jeTransporte = page.getByText("Je transporte les carcasses moi").first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // 3. Ajouter un deuxième destinataire
  const ajouterBtn = page.getByRole("button", { name: "Ajouter un autre destinataire" });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  // 4. Vérifier que les 2 groupes sont visibles
  await expect(page.getByRole("heading", { name: /Destinataire 1/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: /Destinataire 2/ })).toBeVisible();

  // 5. Dans le groupe 2, cliquer sur 2 carcasses pour les déplacer
  const group2 = page.locator("div.rounded.border").nth(1);
  await group2.scrollIntoViewIfNeeded();
  const group2CarcasseButtons = group2.locator("button[type='button']").filter({ hasText: "N°" });
  await group2CarcasseButtons.nth(0).click();
  await group2CarcasseButtons.nth(1).click();

  // 6. Vérifier les compteurs : 2 dans chaque groupe
  const group1 = page.locator("div.rounded.border").first();
  await expect(group1.getByText("2 carcasse")).toBeVisible();
  await expect(group2.getByText("2 carcasse")).toBeVisible();

  // 7. Sélectionner ETG 2 pour le groupe 2
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole("option", { name: "ETG 2 - 75000 Paris (" }).click();

  // 8. Remplir stockage et transport pour le groupe 2
  const g2PasDeStockage = group2.getByText("Pas de stockage").first();
  await g2PasDeStockage.scrollIntoViewIfNeeded();
  await g2PasDeStockage.click();

  const g2Transport = group2.getByText("Je transporte les carcasses moi").first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  // 9. Soumettre
  const transmettreBtn = page.getByRole("button", { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Attribution effectu/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ETG 1.*2 carcasse/)).toBeVisible();
  await expect(page.getByText(/ETG 2.*2 carcasse/)).toBeVisible();

  // 10. Connecter en tant que ETG 1 et vérifier qu'il ne voit que 2 carcasses
  await context.clearCookies();
  await connectWith(page, "etg-1@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/2 autre.*carcasse.*ne vous concern/)).toBeVisible({ timeout: 10000 });
  // Verify the section title shows "Carcasses (2)" not "Carcasses (4)"
  await expect(page.getByText("Carcasses (2)")).toBeVisible();

  // Le bouton de prise en charge doit être visible
  await page.getByRole("heading", { name: "🫵 Cette fiche a été attribuée" }).click();
  const priseEnChargeBtn = page.getByRole("button", { name: "Je prends en charge les carcasses" });
  await expect(priseEnChargeBtn).toBeVisible();
  await priseEnChargeBtn.click();

  // Après la prise en charge, le bouton doit disparaître
  await expect(priseEnChargeBtn).not.toBeVisible({ timeout: 10000 });
  // After take-charge, should still see only 2 carcasses in the intermediaire section
  await expect(page.getByText("Carcasses (2)")).toBeVisible();

  // 11. Connecter en tant que ETG 2 et vérifier qu'il ne voit que 2 carcasses
  await context.clearCookies();
  await connectWith(page, "etg-2@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/2 autre.*carcasse.*ne vous concern/)).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Carcasses (2)")).toBeVisible();
  await page.getByRole("heading", { name: "🫵 Cette fiche a été attribuée" }).click();
  const priseEnChargeBtn2 = page.getByRole("button", { name: "Je prends en charge les carcasses" });
  await expect(priseEnChargeBtn2).toBeVisible();
  await priseEnChargeBtn2.click();
  await expect(priseEnChargeBtn2).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Carcasses (2)")).toBeVisible();
});
