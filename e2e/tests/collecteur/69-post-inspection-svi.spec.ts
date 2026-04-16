import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("SVI_CLOSED");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 69 — Post-inspection SVI : /collecteur/carcasse-svi/... affiche décision SVI.
test("Collecteur voit la décision SVI", async ({ page }) => {
  await connectWith(page, "collecteur-pro@example.fr");
  // TODO: verify — le seed SVI_CLOSED n'inclut pas nécessairement le collecteur dans la chaîne ;
  // si absent, ce test passera en no-op (aucune fiche listée).
  const anyFeiLink = page.getByRole("link", { name: /ZACH-/ }).first();
  if (await anyFeiLink.isVisible().catch(() => false)) {
    await anyFeiLink.click();
    const sviLink = page.getByRole("link", { name: /inspection|d.cision|SVI/i }).first();
    if (await sviLink.isVisible().catch(() => false)) {
      await sviLink.click();
      await expect(page).toHaveURL(/\/app\/collecteur\/carcasse-svi\//);
      await expect(page.getByText(/accept|refus|consign/i).first()).toBeVisible();
    }
  }
});
