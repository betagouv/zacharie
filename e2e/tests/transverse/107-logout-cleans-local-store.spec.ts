import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";
import { logoutAndConnect } from "../../utils/logout-and-connect";

// Scenario 107 — Logout nettoie le store local.
// After relogin with a different user, previous user's fiches/carcasses must not leak.

test.beforeAll(async () => {
  await resetDb("PREMIER_DETENTEUR");
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test("Déconnexion purge les données du user précédent", async ({ page }) => {
  const feiPD = "ZACH-20250707-QZ6E0-155242";

  // PD logs in and sees their fiche
  await connectWith(page, "premier-detenteur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");
  await expect(page.getByRole("link", { name: feiPD })).toBeVisible();

  // Logout and reconnect as examinateur (who does NOT own this fiche)
  await logoutAndConnect(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  // Previous user's fiche must not be visible
  await expect(page.getByRole("link", { name: feiPD })).not.toBeVisible();
});
