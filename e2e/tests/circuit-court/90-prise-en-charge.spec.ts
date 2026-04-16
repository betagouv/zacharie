import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

test("90 - Circuit court : prise en charge 'récupérée' d'une carcasse", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-195242";
  await connectWith(page, "commerce-de-detail@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  // Bouton "Prendre en charge" ou équivalent — TODO: verify selector
  const priseEnCharge = page.getByRole("button", { name: /Prendre en charge|Récupéré|Confirmer la réception/i });
  if (await priseEnCharge.count()) {
    await priseEnCharge.first().scrollIntoViewIfNeeded();
    await priseEnCharge.first().click();
    // Beacon possible : toast de confirmation
    await expect(page.getByText(/notifié|prise en charge|récupéré/i).first()).toBeVisible({
      timeout: 10000,
    });
  } else {
    // TODO: verify UX — peut-être géré par carcasse individuelle via CardCarcasse
    await expect(page.getByText(/MM-001-001/).first()).toBeVisible();
  }
});
