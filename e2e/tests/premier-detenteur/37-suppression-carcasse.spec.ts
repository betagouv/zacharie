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

test("Suppression carcasse non transmise — disparue après suppression", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();

  // PD must take charge first to get canEditAsPremierDetenteur
  await page.getByRole("button", { name: "Prendre en charge cette" }).click();

  // After taking charge, carcasses in donnees-de-chasse should show trash icons
  const trashIcons = page.getByTitle("Supprimer la carcasse");
  await expect(trashIcons.first()).toBeVisible({ timeout: 10000 });
  const initialCount = await trashIcons.count();

  // Handle window.confirm dialog and delete first carcasse
  page.once("dialog", (dialog) => dialog.accept());
  await trashIcons.first().click();

  // Should have one fewer carcasse
  await expect(trashIcons).toHaveCount(initialCount - 1, { timeout: 10000 });
});
