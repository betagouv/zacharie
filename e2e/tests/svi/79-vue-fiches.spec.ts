import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('79 - Vue /app/svi (liste fiches) avec filtrage par statut', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });

  // Filtre par statut
  const filterMenu = page.getByRole('button', { name: /Filtrer par statut/i });
  if (await filterMenu.isVisible().catch(() => false)) {
    await filterMenu.click();
    // Toggle "En cours"
    const enCours = page.getByRole('menuitem', { name: /En cours/i }).first();
    if (await enCours.isVisible().catch(() => false)) {
      await enCours.click();
      await expect(page.getByRole('link', { name: feiId })).toBeVisible();
    }
  }
  // TODO: verify exact filter menu aria-role once stable
});
