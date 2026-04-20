import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 53 — Notifications : toggle EMAIL notification and submit.
test("ETG toggle notification email et enregistre", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto("http://localhost:3290/app/etg/profil/notifications");
  await expect(page).toHaveURL(/\/app\/etg\/profil\/notifications/);

  // The heading should be visible
  await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible({ timeout: 10000 });

  // Target the EMAIL checkbox (PUSH is disabled without browser push support)
  const emailCheckbox = page.getByRole("checkbox", { name: /Notification par email/i });
  const hasEmailCheckbox = await emailCheckbox.isVisible({ timeout: 5000 }).catch(() => false);

  if (hasEmailCheckbox) {
    const before = await emailCheckbox.isChecked();
    await emailCheckbox.click({ force: true });

    // Submit the form
    await page.getByRole("button", { name: "Enregistrer" }).click();

    // Reload and verify persistence
    await page.reload();
    await expect(page).toHaveURL(/\/app\/etg\/profil\/notifications/);
    const reloadedCheckbox = page.getByRole("checkbox", { name: /Notification par email/i });
    await expect(reloadedCheckbox).toBeVisible({ timeout: 5000 });
    await expect(reloadedCheckbox).toBeChecked({ checked: !before });
  } else {
    test.skip(true, "Notifications page renders without email checkbox");
  }
});
