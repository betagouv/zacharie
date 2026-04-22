import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("COLLECTEUR_PRO");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 65 — Collecteur clicks "Je renvoie la fiche à l'expéditeur"
test("Collecteur renvoie la fiche à l'expéditeur", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-175242";
  await connectWith(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/collecteur");

  await page.getByRole("link", { name: new RegExp(feiId) }).click();
  await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}`));

  // The collecteur sees the CallOut with take-charge and return buttons
  await expect(page.getByRole("button", { name: /Je contrôle et transporte les carcasses/ })).toBeVisible({
    timeout: 10000,
  });

  // Click "Je renvoie la fiche à l'expéditeur"
  const returnBtn = page.getByRole("button", { name: /Je renvoie la fiche à l'expéditeur/ });
  await expect(returnBtn).toBeVisible();
  await returnBtn.click();

  // After returning, the fiche should no longer show the take-charge UI
  // The collecteur should be redirected or the fiche should reflect the return
  await expect(page.getByRole("button", { name: /Je contrôle et transporte les carcasses/ })).not.toBeVisible({
    timeout: 10000,
  });
});
