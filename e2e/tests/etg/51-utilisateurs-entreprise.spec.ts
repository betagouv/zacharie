import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test('ETG voit la liste des utilisateurs de son entreprise', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);

  await expect(page.getByText('ETG 1').first()).toBeVisible({ timeout: 10000 });

  const voirUtilisateurs = page.getByRole('button', { name: 'Voir les utilisateurs' }).first();
  await expect(voirUtilisateurs).toBeVisible({ timeout: 10000 });
  await voirUtilisateurs.click();

  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible({ timeout: 5000 });

  const closeButton = dialog.getByRole('button', { name: /fermer/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press('Escape');
  }
});
