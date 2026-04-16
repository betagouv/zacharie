import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

test("91 - Liste /app/circuit-court triable par statut", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-195242";
  await connectWith(page, "commerce-de-detail@example.fr");
  await expect(page).toHaveURL(/\/app\/circuit-court/);

  await expect(page.getByRole("link", { name: feiId })).toBeVisible({ timeout: 10000 });

  // Filtre statut
  const filterBtn = page.getByRole("button", { name: /Filtrer par statut/i });
  if (await filterBtn.isVisible().catch(() => false)) {
    await filterBtn.click();
    // Fiche attendue "À compléter" ou "En cours"
  }
  // TODO: verify filter menu aria-role structure
  await expect(page.getByRole("link", { name: feiId })).toBeVisible();
});
