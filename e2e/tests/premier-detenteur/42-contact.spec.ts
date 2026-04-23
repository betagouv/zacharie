import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Page contact charge sans erreur', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.goto('http://localhost:3290/app/chasseur/contact');
  await expect(page).toHaveURL(/\/app\/chasseur\/contact/);
  await expect(page.getByRole('heading', { name: /Contact/i }).first()).toBeVisible();
});
