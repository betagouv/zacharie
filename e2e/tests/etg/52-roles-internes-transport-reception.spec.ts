import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 52 — Roles internes (TRANSPORT/RECEPTION).
// The entreprise/informations page shows radio buttons for ETG role.
// etg-1 has RECEPTION role by default.
test("Rôles internes ETG visibles sur la page entreprise", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto("http://localhost:3290/app/etg/entreprise/informations");
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);

  // Wait for entity data to load
  await expect(page.getByText("ETG 1").first()).toBeVisible({ timeout: 10000 });

  // The radio buttons for ETG role should be visible
  const transportRadio = page.getByRole("radio", { name: /Transport des carcasses uniquement/i });
  const receptionRadio = page.getByRole("radio", { name: /Réception des carcasses et gestion de la logistique/i });

  // Both radio options should be visible
  await expect(transportRadio).toBeVisible({ timeout: 10000 });
  await expect(receptionRadio).toBeVisible();

  // etg-1 has RECEPTION role: verify it's checked
  await expect(receptionRadio).toBeChecked();
  await expect(transportRadio).not.toBeChecked();
});
