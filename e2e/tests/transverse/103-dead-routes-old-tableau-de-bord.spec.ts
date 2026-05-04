import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 103 — Legacy URLs /app/tableau-de-bord* are handled by a redirect router.
// Post-cleanup: tableau-de-bord index/layout/router are deleted. A slim redirect router
// at /app/tableau-de-bord* sends users to their role-specific space (used by old emails
// and search results). Unknown paths fall through to the catch-all 404.

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Accès /app/tableau-de-bord redirige vers /app/chasseur', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.goto('http://localhost:3290/app/tableau-de-bord', { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
});

test('/app/tableau-de-bord/fei/:numero redirige vers /app/chasseur/fei/:numero', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.goto('http://localhost:3290/app/tableau-de-bord/fei/dummy-numero', {
    waitUntil: 'domcontentloaded',
  });
  await expect(page).toHaveURL(/\/app\/chasseur\/fei\/dummy-numero/, { timeout: 15000 });
});

test('Sous-routes inconnues /app/tableau-de-bord/* tombent sur la 404', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  for (const path of ['/app/tableau-de-bord/mes-fiches', '/app/tableau-de-bord/onboarding/mon-activite']) {
    const response = await page.goto(`http://localhost:3290${path}`, { waitUntil: 'domcontentloaded' });
    expect(response?.status()).toBeLessThan(500);
    await expect(page.getByRole('heading', { name: 'Page non trouvée' })).toBeVisible({ timeout: 15000 });
  }
});
