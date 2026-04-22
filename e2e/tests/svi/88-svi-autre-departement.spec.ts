import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("SVI");
});

test("88 - SVI d'un autre département peut voir une fiche hors périmètre (by design)", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";
  await connectWith(page, "svi-2@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}`);
  // By design: any SVI can see any fiche — shows "Carcasses à inspecter (0)" since not assigned
  await expect(page.getByText(/Carcasses à inspecter/)).toBeVisible({ timeout: 10000 });
});
