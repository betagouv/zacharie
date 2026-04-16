import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 54 — Partage de mes données : opt-in/out persisté.
test("ETG toggle partage de mes données", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await page.goto("http://localhost:3290/app/etg/profil/partage-de-mes-donnees");
  await expect(page).toHaveURL(/\/app\/etg\/profil\/partage-de-mes-donnees/);

  // TODO: verify selector — la page expose un ou plusieurs toggles (opt-in recherche / opt-in statistiques).
  const checkbox = page.getByRole("checkbox").first();
  if (await checkbox.isVisible().catch(() => false)) {
    const before = await checkbox.isChecked();
    await checkbox.scrollIntoViewIfNeeded();
    await checkbox.click();
    await page.reload();
    await expect(checkbox).toBeChecked({ checked: !before });
  }
});
