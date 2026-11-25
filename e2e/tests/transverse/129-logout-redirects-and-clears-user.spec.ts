import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test('Déconnexion redirige vers /app/connexion et vide useUser', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();

  await page.waitForURL(/\/app\/connexion/, { timeout: 10000 });

  await page.waitForTimeout(5000);
  await expect(page).toHaveURL(/\/app\/connexion/);

  await expect(page.getByRole('textbox', { name: 'Mon email Renseignez votre' })).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('zacharie-zustand-user-store'));
  expect(stored).toBeNull();
});
