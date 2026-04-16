import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("ETG_REFUSED");
});

/**
 * Cas dégénéré : toutes les carcasses ont été refusées par ETG.
 * Le SVI voit la fiche mais aucune carcasse n'est à inspecter.
 */
test("87 - Fiche sans carcasse à inspecter (toutes refusées par ETG)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-215242";
  await connectWith(page, "svi@example.fr");

  // Navigate to the fiche — SVI may see it in listing or access directly
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);

  // Assert "Carcasses à inspecter (0)" since all carcasses were refused upstream by ETG
  await expect(page.getByText(/Carcasses à inspecter \(0\)/).first()).toBeVisible({ timeout: 10000 });
});
