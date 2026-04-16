import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * SVI d'un autre département tente d'accéder à une fiche assignée au SVI 1.
 * svi-2@example.fr est rattaché à "SVI 2" (un autre département).
 * L'accès doit être refusé (redirection ou message d'erreur).
 */
test("88 - SVI d'un autre département : accès refusé à une fiche hors périmètre", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi-2@example.fr");
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  await expect(page.getByText(/(Accès refusé|Fiche introuvable|NotFound)/i)).toBeVisible({ timeout: 10000 });
});
