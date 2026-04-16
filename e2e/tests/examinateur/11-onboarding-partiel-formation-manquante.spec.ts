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

test("Onboarding partiel — coordonnées OK mais pas de formation : création de fiche interdite", async ({ page }) => {
  // TODO: requires seed user avec coordonnées mais sans formation examen initial.
  await connectWith(page, "examinateur-sans-formation@example.fr");

  // On atterrit sur /chasseur (listing), mais le bouton "Nouvelle fiche" doit être absent ou désactivé
  await expect(page).toHaveURL(/\/app\/chasseur/);
  const btn = page.getByTitle("Nouvelle fiche");
  // Soit absent, soit disabled
  if (await btn.count()) {
    await expect(btn).toBeDisabled();
  }
});
