import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 110 — Deep link vers une fiche inconnue.
// /chasseur/fei/ZACH-UNKNOWN → message "fiche introuvable", pas de crash.

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test('Deep link vers fiche inconnue affiche un message propre', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.goto('http://localhost:3290/app/chasseur/fei/ZACH-UNKNOWN');

  // No crash: body renders, and either a "introuvable" message or a redirect home.
  await expect(page.locator('body')).toBeVisible();
  const introuvable = page.getByText(/introuvable|inconnue|pas trouv|404/i).first();
  const atHome = page.url().match(/\/app\/chasseur\/?$/);
  if (!atHome) {
    await expect(introuvable).toBeVisible({ timeout: 10000 });
  }
});
