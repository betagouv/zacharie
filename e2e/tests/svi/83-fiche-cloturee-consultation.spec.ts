import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

test("83 - Fiche déjà clôturée : consultation en lecture seule", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-205242";
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);

  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // svi_closed_at est défini, donc Date de fin d'inspection doit s'afficher
  await expect(page.getByText(/Date de fin d'inspection/)).toBeVisible({ timeout: 10000 });

  // Le bouton "Enregistrer" (validation de clôture) ne doit pas être actif/présent,
  // car la case est readOnly et la fiche est clôturée.
  const enregistrer = page.getByRole("button", { name: "Enregistrer" });
  if (await enregistrer.count()) {
    await expect(enregistrer.first()).toBeDisabled();
  }
});
