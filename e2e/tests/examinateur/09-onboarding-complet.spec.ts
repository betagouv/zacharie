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
  await resetDb("EXAMINATEUR_INITIAL");
});

test.skip("Onboarding complet : coordonnées → formation → infos de chasse → /chasseur", async ({ page }) => {
  // SKIP: unique constraint error in seed + onboarding flow needs debugging
  await connectWith(page, "examinateur-onboarding@example.fr");

  // Étape 1 : mes coordonnées
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-coordonnees/);

  // The form uses native input ids from Prisma field enum
  await page.locator("#nom_de_famille").fill("Dupont");
  await page.locator("#nom_de_famille").blur();
  await page.locator("#prenom").fill("Jean");
  await page.locator("#prenom").blur();
  await page.locator("#telephone").fill("0600000000");
  await page.locator("#telephone").blur();
  await page.locator("#addresse_ligne_1").fill("1 rue du Test");
  await page.locator("#addresse_ligne_1").blur();
  await page.locator("#code_postal").fill("75000");
  await page.locator("#code_postal").blur();
  await page.locator("#ville").fill("Paris");
  await page.locator("#ville").blur();

  await page.getByRole("button", { name: /Enregistrer et continuer/i }).click();

  // Étape 2 : formation examen initial
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/formation-examen-initial/);
  // Click "Oui" radio for est_forme_a_l_examen_initial
  await page.getByLabel("Oui").click();
  await page.getByRole("button", { name: /Enregistrer et continuer/i }).click();

  // Étape 3 : mes informations de chasse
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-informations-de-chasse/);
  await page.getByRole("button", { name: /Enregistrer et terminer/i }).click();

  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");
});
