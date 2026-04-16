import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * Traitement assainissant = IPM2Decision.TRAITEMENT_ASSAINISSANT.
 * Ne peut être choisi que si IPM1 n'est pas ACCEPTE (i.e. MISE_EN_CONSIGNE).
 * TODO: verify IPM2 form selectors — best-effort checks on the presence of the option.
 */
test("77 - SVI inspection : traitement assainissant (IPM2)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: /Daim.*MM-001-001/ }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Vérifier que la section IPM2 est visible (car IPM1 pas encore signée / pas ACCEPTE)
  await expect(page.getByText(/Inspection Post-Mortem 2/)).toBeVisible();

  // Vérifier que l'option "Traitement assainissant" est présente dans l'IPM2
  await expect(page.getByText(/Traitement assainissant/i).first()).toBeVisible({ timeout: 10000 });
});
