import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test("Suppression carcasse non transmise — disparue après relogin", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-155242";
  await connectWith(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();

  await page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" }).click();
  const supprimer = page.getByRole("button", { name: /Supprimer/i }).first(); // TODO: verify selector
  await supprimer.scrollIntoViewIfNeeded();
  await supprimer.click();
  const confirm = page.getByRole("button", { name: /Oui|Confirmer/i }).first();
  if (await confirm.count()) await confirm.click();

  await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toHaveCount(0);

  // Relogin
  await logoutAndConnect(page, "premier-detenteur@example.fr");
  await page.getByRole("link", { name: feiId }).click();
  await expect(page.getByRole("button", { name: "Daim N° MM-001-001 Mise à" })).toHaveCount(0);
});
