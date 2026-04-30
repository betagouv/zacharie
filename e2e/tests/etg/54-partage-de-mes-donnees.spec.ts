import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 54 — Partage de mes données : API key sections visible.
test('ETG voit les sections clé dédiée et accès personnel', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  // Wait for login to complete
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto('http://localhost:3290/app/etg/profil/partage-de-mes-donnees');
  await expect(page).toHaveURL(/\/app\/etg\/profil\/partage-de-mes-donnees/);

  // Assert "Votre clé dédiée" section visible (entity-wide dedicated API key)
  await expect(page.getByText('Votre clé dédiée')).toBeVisible({ timeout: 10000 });

  // Assert "Accès à votre compte personnel" section visible (user-wide API key)
  await expect(page.getByText('Accès à votre compte personnel')).toBeVisible({ timeout: 10000 });

  // Assert the approval status selector is present (shows current status)
  const approvalSelector = page
    .getByText(/En attente de mon accord/)
    .or(page.getByText(/J'ai donné mon accord/).or(page.getByText(/J'ai refusé l'accord/)));
  await expect(approvalSelector.first()).toBeVisible({ timeout: 10000 });
});
