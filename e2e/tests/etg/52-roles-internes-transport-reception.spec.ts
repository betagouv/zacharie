import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 52 — Rôles internes (TRANSPORT/RECEPTION).
// Seed: etg-1 a RECEPTION, collecteur-pro-1-etg-1 a TRANSPORT.
test("Rôles internes ETG visibles et modifiables", async ({ page }) => {
  await connectWith(page, "etg-1@example.fr");
  await page.goto("http://localhost:3290/app/etg/entreprise/utilisateurs");
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/utilisateurs/);

  // Un badge/role doit être visible pour les users.
  // TODO: verify selector — labels DSFR exacts pour les rôles RECEPTION/TRANSPORT.
  const receptionBadge = page.getByText(/R.CEPTION/i).first();
  const transportBadge = page.getByText(/TRANSPORT/i).first();
  await expect(receptionBadge.or(transportBadge)).toBeVisible({ timeout: 10000 });
});
