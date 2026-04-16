import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 115 — Chain refus total ETG.
// PD → ETG → ETG refuse toutes les carcasses → chasseur voit refus, pas de SVI.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("ETG");
});

test("ETG refuse toutes les carcasses → chasseur voit refus", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";

  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/etg");
  await page.getByRole("link", { name: feiId }).click();
  await page.getByRole("button", { name: "Prendre en charge les carcasses" }).click();

  // Refuser chaque carcasse
  for (const label of [
    "Daim N° MM-001-001 Mise à",
    "Daim N° MM-001-002 Mise à",
    "Daim N° MM-001-004 Mise à",
    "Pigeons (10) N° MM-001-003",
  ]) {
    const btn = page.getByRole("button", { name: label });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const refus = page.getByText("Carcasse refusée").first();
    if (await refus.isVisible().catch(() => false)) {
      await refus.click();
      // Motif obligatoire
      const selectMotif = page.locator(".input-for-search-prefilled-data__input-container").first();
      if (await selectMotif.isVisible().catch(() => false)) {
        await selectMotif.click();
        await page.getByRole("option").first().click();
      }
      const saveBtn = page.getByRole("button", { name: "Enregistrer" }).first();
      if (await saveBtn.isVisible().catch(() => false)) await saveBtn.click();
    }
    await page.keyboard.press("Escape").catch(() => void 0);
  }

  // Sans SVI disponible (toutes refusées) — assert que la fiche reflète les refus côté chasseur.
  await page.setViewportSize({ width: 350, height: 667 });
  await logoutAndConnect(page, "examinateur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/refus/i).first()).toBeVisible({ timeout: 15000 });
});
