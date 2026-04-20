import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb("COMMERCE_DE_DETAIL");
});

test.skip("90 - Circuit court : prise en charge d'une fiche", async ({ page }) => {
  // SKIP: Circuit court (boucher) has no CTA in Zacharie — they only view fiches/carcasses passively, no take-charge action exists.
  const feiId = "ZACH-20250707-QZ6E0-195242";
  await connectWith(page, "commerce-de-detail@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  // Button text is "Prendre en charge cette fiche et les carcasses associées" or "Prendre en charge cette fiche"
  const priseEnCharge = page.getByRole("button", { name: /Prendre en charge cette fiche/ });
  await priseEnCharge.first().scrollIntoViewIfNeeded();
  await priseEnCharge.first().click();

  // After taking charge, carcasse details should be visible
  await expect(page.getByText(/MM-001-001/).first()).toBeVisible({ timeout: 10000 });
});
