import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test('80 - Vue /app/svi/carcasses agrégée', async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);

  await page.goto('http://localhost:3290/app/svi/carcasses');
  await expect(page).toHaveURL(/\/app\/svi\/carcasses/);

  // Les 4 carcasses de la seed doivent figurer
  await expect(page.getByText(/MM-001-001/).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/MM-001-002/).first()).toBeVisible();
  await expect(page.getByText(/MM-001-003/).first()).toBeVisible();
  await expect(page.getByText(/MM-001-004/).first()).toBeVisible();
});
