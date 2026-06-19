import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG_ALL_REFUSED_TO_SVI');
});

/**
 * Cas dégénéré : toutes les carcasses ont été refusées par ETG.
 * Le SVI voit la fiche mais aucune carcasse n'est à inspecter.
 */
test('87 - Fiche sans carcasse à inspecter (toutes refusées par ETG)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-225242';
  await connectWith(page, 'svi@example.fr');
  // Wait for login to complete and redirect to SVI dashboard
  await expect(page).toHaveURL(/\/app\/svi/, { timeout: 15000 });

  // Navigate to the fiche via the list (l'URL porte l'id du prochain détenteur)
  await page.getByRole('link', { name: new RegExp(feiId) }).first().click();

  // Assert "Carcasses à inspecter (0)" since all carcasses were refused upstream by ETG
  await expect(page.getByText(/Carcasses à inspecter \(0\)/).first()).toBeVisible({ timeout: 10000 });
});
