import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 103 — Dead routes /app/tableau-de-bord* must resolve cleanly (redirect or 404).
// Post-refacto: 5 role routers replace the old /app/tableau-de-bord router.

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Accès /app/tableau-de-bord redirige proprement (pas de crash)", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  // Hit old dead routes
  for (const path of [
    "/app/tableau-de-bord",
    "/app/tableau-de-bord/fei",
    "/app/tableau-de-bord/mes-fiches",
  ]) {
    await page.goto(`http://localhost:3290${path}`);
    // Either 404 page or redirect to the proper role router. No crash = page title/body renders.
    await expect(page.locator("body")).toBeVisible();
    // Should NOT stay on a broken /app/tableau-de-bord/* path for an authenticated user ;
    // expect a redirect to /app/chasseur or a visible 404.
    const url = page.url();
    const onDashboard = url.includes("/app/tableau-de-bord");
    if (onDashboard) {
      // Tolerated only if a clean 404/page introuvable is shown.
      await expect(page.getByText(/introuvable|404|not found/i).first()).toBeVisible({ timeout: 5000 });
    }
  }
});
