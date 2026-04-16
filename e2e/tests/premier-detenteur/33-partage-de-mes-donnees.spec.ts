import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Partage de mes données : opt-in/out persisté", async ({ page }) => {
  await connectWith(page, "premier-detenteur@example.fr");
  await page.goto("http://localhost:3290/app/chasseur/profil/partage-de-mes-donnees");

  const checkbox = page.getByRole("checkbox").first(); // TODO: verify selector
  await checkbox.scrollIntoViewIfNeeded();
  const wasChecked = await checkbox.isChecked();
  if (wasChecked) {
    await checkbox.uncheck();
  } else {
    await checkbox.check();
  }

  const save = page.getByRole("button", { name: /Enregistrer|Sauver/i }).first();
  if (await save.count()) await save.click();

  await page.reload();
  const newChecked = await page.getByRole("checkbox").first().isChecked();
  expect(newChecked).toBe(!wasChecked);
});
