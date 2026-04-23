import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 51 — Utilisateurs de l'entreprise : see users list on entreprise page.
test('ETG voit la liste des utilisateurs de son entreprise', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  // Wait for login to complete — ETG user lands on /app/etg
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);

  // The entity name "ETG 1" should be visible on the page
  await expect(page.getByText('ETG 1').first()).toBeVisible({ timeout: 10000 });

  // Click "Voir la liste des utilisateurs" to open the modal
  const voirUtilisateurs = page.getByRole('button', { name: 'Voir la liste des utilisateurs' }).first();
  await expect(voirUtilisateurs).toBeVisible({ timeout: 10000 });
  await voirUtilisateurs.click();

  // Modal should open showing users of the entity
  const dialog = page.getByRole('dialog').first();
  await expect(dialog).toBeVisible({ timeout: 5000 });

  // Close the modal
  const closeButton = dialog.getByRole('button', { name: /fermer/i }).first();
  if (await closeButton.isVisible().catch(() => false)) {
    await closeButton.click();
  } else {
    await page.keyboard.press('Escape');
  }
});
