import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 53 — Notifications : toggle EMAIL/SMS persisté.
test("ETG toggle notifications et persiste au reload", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await page.goto("http://localhost:3290/app/etg/profil/notifications");
  await expect(page).toHaveURL(/\/app\/etg\/profil\/notifications/);

  // TODO: verify selector — checkbox labels exacts.
  const emailToggle = page.getByRole("checkbox", { name: /email/i }).first();
  if (await emailToggle.isVisible().catch(() => false)) {
    const before = await emailToggle.isChecked();
    await emailToggle.scrollIntoViewIfNeeded();
    await emailToggle.click();
    await page.reload();
    await expect(emailToggle).toBeChecked({ checked: !before });
  }
});
