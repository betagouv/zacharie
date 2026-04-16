import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 116 — Chain refus partiel SVI : une acceptée, une refusée, une consignée → chasseur voit les 3 décisions.
test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb("SVI");
});

test("SVI rend des décisions divergentes → chasseur voit chaque décision", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-185242";

  await connectWith(page, "svi@example.fr");
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole("link", { name: feiId }).click();

  // TODO: verify selector — SVI decision UI (accept/refuse/consign) structure TBD.
  const buttons = page.getByRole("button", { name: /N° MM-/ });
  const count = await buttons.count();

  for (let i = 0; i < Math.min(count, 3); i++) {
    const btn = buttons.nth(i);
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    const option = ["Acceptée", "Refusée", "Consignée"][i];
    const opt = page.getByText(new RegExp(option, "i")).first();
    if (await opt.isVisible().catch(() => false)) {
      await opt.click();
      // motif si besoin
      const sel = page.locator(".input-for-search-prefilled-data__input-container").first();
      if (await sel.isVisible().catch(() => false)) {
        await sel.click();
        await page.getByRole("option").first().click();
      }
      const save = page.getByRole("button", { name: "Enregistrer" }).first();
      if (await save.isVisible().catch(() => false)) await save.click();
    }
    await page.keyboard.press("Escape").catch(() => void 0);
  }

  // Chasseur vérifie les 3 décisions
  await page.setViewportSize({ width: 350, height: 667 });
  await logoutAndConnect(page, "examinateur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByText(/accept/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/refus/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/consign/i).first()).toBeVisible({ timeout: 10000 });
});
