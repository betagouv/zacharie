import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('79 - Vue /app/svi (liste fiches) avec barre latérale de filtres', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });

  // La liste des transmissions affiche désormais une barre latérale de filtres (recherche + statut).
  await expect(page.getByPlaceholder('Rechercher une fiche...').first()).toBeVisible();
});
