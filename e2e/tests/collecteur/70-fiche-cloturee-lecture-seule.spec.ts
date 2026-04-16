import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 70 — Fiche clôturée : lecture seule, pas d'action.
test("Collecteur ne peut plus agir sur une fiche clôturée", async ({ page }) => {
  await connectWith(page, "collecteur-pro@example.fr");
  const anyFeiLink = page.getByRole("link", { name: /ZACH-/ }).first();
  if (await anyFeiLink.isVisible().catch(() => false)) {
    await anyFeiLink.click();
    await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Transmettre la fiche" })).toHaveCount(0);
  }
});
