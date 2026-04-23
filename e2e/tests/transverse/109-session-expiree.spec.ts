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
});
