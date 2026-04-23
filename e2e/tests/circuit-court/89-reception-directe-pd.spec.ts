import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test('89 - Circuit court : réception directe depuis Premier Détenteur (sans ETG)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  await connectWith(page, 'commerce-de-detail@example.fr');
  await expect(page).toHaveURL(/\/app\/circuit-court/);

  // La fiche transmise par PD doit être listée
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });

  // Ouverture de la fiche
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));
  // Titre fiche + section carcasses
  await expect(page.getByRole('heading', { name: new RegExp(`Fiche ${feiId}`) })).toBeVisible();
  await expect(page.getByText(/Carcasses \(\d+\)/)).toBeVisible();
});
