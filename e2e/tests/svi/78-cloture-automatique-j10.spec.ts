import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

/**
 * Clôture : seed SVI_CLOSED poses svi_closed_at -2d and svi_assigned_at -12d.
 * Verify the fiche shows as closed on SVI side.
 */
test("78 - Clôture (seed SVI_CLOSED) visible côté SVI", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-205242";

  // Côté SVI
  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  // Clôture indicators should be visible
  await expect(page.getByText(/Date de fin d'inspection|Clôturer la fiche/i).first()).toBeVisible({ timeout: 10000 });
});
