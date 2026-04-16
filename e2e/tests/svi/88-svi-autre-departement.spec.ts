import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * TODO: seed second SVI user for SVI 2 — actuellement non disponible dans populate-test-db.ts.
 * Sans cet utilisateur, on ne peut que vérifier qu'un SVI d'un autre département
 * (non connecté à la fiche) ne voit pas la fiche ZACH-20250707-QZ6E0-185242.
 *
 * Placeholder test : skippé jusqu'à ce que la seed soit disponible.
 */
test.skip("88 - SVI d'un autre département : accès refusé à une fiche hors périmètre", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  // TODO: connectWith(page, 'svi-2@example.fr')
  await connectWith(page, "svi@example.fr");
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  await expect(page.getByText(/(Accès refusé|Fiche introuvable|NotFound)/i)).toBeVisible();
});
