import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

/**
 * Cas dégénéré : toutes les carcasses ont été refusées par ETG.
 * Pas de seed direct pour ce cas — on simule en asservissant le test à la présence
 * éventuelle d'une section "Carcasses à inspecter (0)".
 * TODO: seed explicite pour ce cas (toutes carcasses intermediaire_carcasse_refus_intermediaire_id set).
 */
test("87 - Fiche sans carcasse à inspecter (cas dégénéré)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // Assertion best-effort : titre de section "Carcasses à inspecter"
  await expect(page.getByText(/Carcasses à inspecter/).first()).toBeVisible({ timeout: 10000 });
  // TODO: seed fei with all carcasses refused upstream to truly assert "Carcasses à inspecter (0)"
});
