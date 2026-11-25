import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test('ETG administrateur voit les sections et donne son accord pour la clé dédiée', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('link', { name: 'Partage de données' }).click();
  await expect(page).toHaveURL(/\/app\/etg\/profil\/partage-de-mes-donnees/);

  await expect(page.getByText('Votre clé dédiée')).toBeVisible({ timeout: 10000 });

  await expect(page.getByText('Accès à votre compte personnel')).toBeVisible({ timeout: 10000 });

  const dedicatedKey = page.locator('div.bg-contrast-grey').filter({ hasText: 'Test API Key Dedicated' });
  await expect(dedicatedKey.getByText('En attente de mon accord')).toBeVisible({ timeout: 10000 });
  await dedicatedKey.getByRole('combobox').click();
  await page.getByRole('option', { name: "J'ai donné mon accord" }).click();
  await expect(dedicatedKey.getByText("J'ai donné mon accord")).toBeVisible({ timeout: 10000 });

  await page.reload();
  await expect(
    page
      .locator('div.bg-contrast-grey')
      .filter({ hasText: 'Test API Key Dedicated' })
      .getByText("J'ai donné mon accord")
  ).toBeVisible({ timeout: 10000 });
});

test("ETG membre non administrateur ne peut pas modifier l'accord de la clé dédiée", async ({ page }) => {
  await connectWith(page, 'collecteur-pro-1-etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.getByRole('button', { name: 'Paramètres' }).click();
  await page.getByRole('link', { name: 'Partage de données' }).click();
  await expect(page).toHaveURL(/\/app\/etg\/profil\/partage-de-mes-donnees/);

  const dedicatedKey = page.locator('div.bg-contrast-grey').filter({ hasText: 'Test API Key Dedicated' });
  await expect(dedicatedKey.getByText('En attente de mon accord')).toBeVisible({ timeout: 10000 });
  await expect(
    dedicatedKey.getByText("Seul un administrateur de l'entité peut modifier l'accord")
  ).toBeVisible();
  await expect(dedicatedKey.getByRole('combobox')).toHaveCount(0);
});
