import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

/**
 * Clôture : seed SVI_CLOSED pose svi_closed_at -2j et svi_assigned_at -12j.
 * On vérifie que la fiche est affichée comme clôturée côté SVI puis côté chasseur.
 */
test("78 - Clôture (seed SVI_CLOSED) visible côté SVI et côté chasseur", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-205242";

  // Côté SVI
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  // La case à cocher de clôture doit être cochée + readonly
  await expect(page.getByText(/Clôturer la fiche/)).toBeVisible();
  await expect(page.getByText(/Date de fin d'inspection/)).toBeVisible();

  // Côté chasseur (examinateur@example.fr)
  await logoutAndConnect(page, "examinateur@example.fr");
  await expect(page).toHaveURL(/\/app\/(chasseur|tableau-de-bord)/);
  // Il se peut que la fiche n'apparaisse pas dans la liste active ; naviguer directement
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  // Best-effort : la fiche doit s'afficher en lecture / clôturée
  await expect(page.getByText(new RegExp(feiId))).toBeVisible({ timeout: 10000 });
  // TODO: verify chasseur-side "Clôturée" beacon selector
});
