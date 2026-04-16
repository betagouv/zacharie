import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 72 — Fiche attribuée à un autre collecteur : accès refusé.
// Seed ETG : la fiche ZACH-...-165242 est attribuée à ETG 1, pas au collecteur.
test("Collecteur ne peut pas accéder à une fiche non attribuée", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "collecteur-pro@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/collecteur");

  await expect(page.getByRole("link", { name: new RegExp(feiId) })).toHaveCount(0);

  await page.goto(`http://localhost:3290/app/collecteur/fei/${feiId}`);
  // TODO: verify selector — refus / redirect / "fiche introuvable".
  const notFound = page.getByText(/introuvable|acc.s refus|non autoris/i).first();
  const listPage = page.getByRole("heading", { name: /Mes fiches|fiches/i }).first();
  await expect(notFound.or(listPage)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).toHaveCount(0);
});
