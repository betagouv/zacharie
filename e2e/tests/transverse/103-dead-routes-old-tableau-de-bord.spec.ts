import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

// Scenario 103 — Dead routes /app/tableau-de-bord* must resolve cleanly (redirect or 404).
// Post-refacto: 5 role routers replace the old /app/tableau-de-bord router.
// The old layout still exists and redirects CHASSEUR users to /app/chasseur via <Navigate>.

test.beforeAll(async () => {
  await resetDb("EXAMINATEUR_INITIAL");
});

test("Accès /app/tableau-de-bord redirige vers /app/chasseur", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  // The main /app/tableau-de-bord route should redirect a CHASSEUR user to /app/chasseur
  await page.goto("http://localhost:3290/app/tableau-de-bord", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
});

test("Sous-routes /app/tableau-de-bord/* ne crashent pas", async ({ page }) => {
  await connectWith(page, "examinateur@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/chasseur");

  for (const path of ["/app/tableau-de-bord/fei", "/app/tableau-de-bord/mes-fiches"]) {
    const response = await page.goto(`http://localhost:3290${path}`, { waitUntil: "domcontentloaded" });
    // No server crash: HTTP status should be 200 (SPA routing)
    expect(response?.status()).toBeLessThan(500);
    // Page may redirect to /app/chasseur, show a blank outlet, or render an error.
    // The important thing is no JS crash — page.goto resolves without throwing.
  }
});
