import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Token expiré/invalide redirige vers /app/connexion', async ({ page, context }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const cookies = await context.cookies();
  const tampered = cookies.map((c) => ({ ...c, value: 'invalid-token' }));
  await context.clearCookies();
  await context.addCookies(tampered);

  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 15000 });

  await expect(page.getByRole('textbox', { name: 'Mon email Renseignez votre' })).toBeVisible();

  const stored = await page.evaluate(() => localStorage.getItem('zacharie-zustand-user-store'));
  expect(stored).toBeNull();
});
