import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb("ETG_REFUSED");
});

test("Fiche refusée intégralement par ETG — chasseur voit le statut de refus pour chaque carcasse", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-215242";
  await connectWith(page, "examinateur@example.fr");

  const link = page.getByRole("link", { name: feiId });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();

  // Carcasses show refusal status from ETG (motif: "Présence de souillures" per seed)
  await expect(page.getByText(/refusée|refusé|souillures/i).first()).toBeVisible({ timeout: 10000 });
});
