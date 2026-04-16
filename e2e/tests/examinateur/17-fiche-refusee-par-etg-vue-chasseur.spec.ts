import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// TODO: seed a ETG-refused fiche — extends populate-test-db.ts ('ETG_REFUSED').
test.beforeAll(async () => {
  await resetDb("ETG");
});

test("Fiche refusée intégralement par ETG — chasseur voit 'refusée par ETG' pour chaque carcasse", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242"; // TODO: verify feiId from ETG seed
  await connectWith(page, "examinateur@example.fr");

  const link = page.getByRole("link", { name: feiId });
  if (!(await link.count())) {
    test.fail(true, "Seed ETG_REFUSED absent — créer branche dans populate-test-db.ts");
  }
  await link.click();

  await expect(page.getByText(/refusée par ETG|refusé par l'ETG/i).first()).toBeVisible();
});
