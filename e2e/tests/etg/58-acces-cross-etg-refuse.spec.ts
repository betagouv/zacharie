import { test, expect } from "@playwright/test";
import { resetDb } from "../../scripts/reset-db";
import { connectWith } from "../../utils/connect-with";

test.beforeEach(async () => {
  await resetDb("ETG");
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 58 — Accès cross-ETG refusé.
// etg-2 tente d'accéder à une fiche attribuée à l'ETG 1.
test("ETG 2 ne peut pas accéder à la fiche de l'ETG 1", async ({ page }) => {
  const feiId = "ZACH-20250707-QZ6E0-165242";
  await connectWith(page, "etg-2@example.fr");
  await expect(page).toHaveURL("http://localhost:3290/app/etg");

  // La fiche ne doit pas figurer dans la liste.
  await expect(page.getByRole("link", { name: feiId })).toHaveCount(0);

  // Accès direct → refus / redirection / fiche introuvable.
  await page.goto(`http://localhost:3290/app/etg/fei/${feiId}`);
  // TODO: verify selector — message exact peut être "fiche introuvable" ou redirection vers /app/etg.
  const notFound = page.getByText(/introuvable|acc.s refus|non autoris/i).first();
  const listPage = page.getByRole("heading", { name: /Mes fiches|fiches/i }).first();
  await expect(notFound.or(listPage)).toBeVisible({ timeout: 10000 });
  // La fiche elle-même ne doit PAS être affichée en détail.
  await expect(page.getByRole("button", { name: "Prendre en charge les carcasses" })).toHaveCount(0);
});
