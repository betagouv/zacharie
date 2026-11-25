import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test("ETG 2 ne peut pas accéder à la fiche de l'ETG 1", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-2@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  await expect(page.getByRole('link', { name: feiId })).toHaveCount(0);

  await page.goto(`http://localhost:3290/app/etg/fei/${feiId}`);
  const errorPage = page.getByText(/Erreur|introuvable|acc.s refus|non autoris/i).first();
  await expect(errorPage).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).toHaveCount(0);
});
