import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// TODO: requires seed d'un user examinateur fraîchement créé (sans coordonnées ni formation).
// Aujourd'hui `EXAMINATEUR_INITIAL` seed crée un user complet ; ce test échouera jusqu'à
// ce que `populate-test-db.ts` génère un user "onboarding-pending".
test.beforeEach(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test.skip("Onboarding complet : coordonnées → formation → infos de chasse → /chasseur", async ({ page }) => {
  // SKIP: need to verify exact onboarding form selectors against live app
  await connectWith(page, "examinateur-onboarding@example.fr"); // TODO: verify seed user
  // Étape 1 : mes coordonnées
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-coordonnees/);
  await page.getByRole("textbox", { name: /Prénom/i }).fill("Jean");
  await page.getByRole("textbox", { name: /Nom/i }).fill("Dupont");
  await page.getByRole("textbox", { name: /Téléphone/i }).fill("0600000000");
  await page.getByRole("textbox", { name: /Adresse/i }).first().fill("1 rue du Test");
  await page.getByRole("textbox", { name: /Code postal/i }).fill("75000");
  await page.getByRole("textbox", { name: /Ville/i }).fill("Paris");
  await page.getByRole("button", { name: /Continuer|Enregistrer/ }).click();

  // Étape 2 : formation examen initial
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/formation-examen-initial/);
  await page.getByText(/J'ai suivi la formation/i).click();
  await page.getByRole("button", { name: /Continuer|Enregistrer/ }).click();

  // Étape 3 : mes informations de chasse
  await expect(page).toHaveURL(/\/app\/chasseur\/onboarding\/mes-informations-de-chasse/);
  await page.getByRole("button", { name: /Continuer|Terminer/ }).click();

  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");
});
