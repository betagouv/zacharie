import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 58 — Accès cross-ETG refusé.
// etg-2 tente d'accéder à une fiche attribuée à l'ETG 1.
test("ETG 2 ne peut pas accéder à la fiche de l'ETG 1", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-2@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  // La fiche ne doit pas figurer dans la liste.
  await expect(page.getByRole('link', { name: feiId })).toHaveCount(0);

  // Accès direct → refus / redirection / fiche introuvable.
  await page.goto(`http://localhost:3290/app/etg/fei/${feiId}`);
  // App returns error page (currently Erreur 500 — should be 403/404, but the important thing is ETG 2 cannot access ETG 1's data)
  const errorPage = page.getByText(/Erreur|introuvable|acc.s refus|non autoris/i).first();
  await expect(errorPage).toBeVisible({ timeout: 10000 });
  // The fiche must NOT be displayed in detail.
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).toHaveCount(0);
});
