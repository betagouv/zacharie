import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch vers commerce de détail — circuit court direct sans ETG', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /Commerce de Détail 1/i }).click();

  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  // Circuit court: no transport step needed

  const transmettre = page.getByRole('button', { name: 'Transmettre' });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Commerce de Détail 1 a été notifié/i).first()).toBeVisible({
    timeout: 10000,
  });

  // Page /envoyée — le PD seedé n'a pas de numero_cfei : le raccourci « Nouvelle fiche »
  // doit être caché (sinon le clic appellerait createNewFei() qui jette « Forbidden »).
  await expect(page.getByRole('button', { name: 'Nouvelle fiche' })).toHaveCount(0);
});
