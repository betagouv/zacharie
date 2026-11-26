import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Rôles internes ETG visibles sur la page entreprise', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);

  await expect(page.getByText('ETG 1').first()).toBeVisible({ timeout: 10000 });

  const transportRadio = page.getByRole('radio', { name: /Transport des carcasses uniquement/i });
  const receptionRadio = page.getByRole('radio', {
    name: /Réception des carcasses et gestion de la logistique/i,
  });

  await expect(transportRadio).toBeVisible({ timeout: 10000 });
  await expect(receptionRadio).toBeVisible();

  await expect(receptionRadio).toBeChecked();
  await expect(transportRadio).not.toBeChecked();
});
