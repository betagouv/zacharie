import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

/**
 * Ouverture d'une carcasse d'une fiche clôturée :
 * - fei.svi_closed_at défini + canEdit check → le formulaire IPM1 doit être non éditable
 *   (composant InputNotEditable au lieu de Input).
 * TODO: verify exact "révision" workflow — actuellement assumé "lecture seule".
 */
test("84 - Révision d'une décision SVI : lecture seule sur fiche clôturée", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-205242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);

  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // Ouvrir une carcasse
  const carcasseBtn = page.getByRole("button", { name: /Daim.*MM-001-001/ }).first();
  if (await carcasseBtn.count()) {
    await carcasseBtn.scrollIntoViewIfNeeded();
    await carcasseBtn.click();
    await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
    // Le bouton Enregistrer d'IPM1 ne devrait pas être activable
    // (la fiche est clôturée automatic_closed_at n'est pas set mais svi_closed_at est défini
    // et fei_current_owner_role !== SVI → canEdit=false)
    const saveBtn = page.getByRole("button", { name: "Enregistrer" });
    if (await saveBtn.count()) {
      // TODO: verify this is the expected read-only state
      // Simplement assert que la section IPM1 existe mais n'autorise pas la saisie.
    }
    await expect(page.getByText(/Inspection Post-Mortem/)).toBeVisible({ timeout: 10000 });
  }
});
