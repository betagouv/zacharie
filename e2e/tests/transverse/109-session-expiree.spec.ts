import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 109 — Session expirée (token JWT invalide).
// Expected: user redirigé vers /app/connexion. Store local-first préservé (données en IndexedDB).

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Token expiré/invalide redirige vers /app/connexion', async ({ page, context }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  // Corrupt the auth cookie(s) to simulate an expired/invalid token.
  const cookies = await context.cookies();
  const tampered = cookies.map((c) => ({ ...c, value: 'invalid-token' }));
  await context.clearCookies();
  await context.addCookies(tampered);

  // Navigate to a protected page; server should reject and frontend should redirect.
  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 15000 });

  // Prove the route actually rerendered (URL alone could change without a route swap
  // if pushState fired without a popstate dispatch — the regression we are guarding).
  await expect(page.getByRole('textbox', { name: 'Mon email Renseignez votre' })).toBeVisible();

  // useUser must be cleared so /app/connexion doesn't bounce back to /app/[role] in offline mode.
  const stored = await page.evaluate(() => localStorage.getItem('zacharie-zustand-user-store'));
  expect(stored).toBeNull();
});
