import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 48 — Vue /etg/carcasses agrégée
test('ETG voit ses carcasses dans la vue agrégée', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/carcasses');
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/);

  // Les 4 carcasses seed doivent apparaître (MM-001-001/002/003/004).
  await expect(page.getByText('MM-001-001').first()).toBeVisible();
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003').first()).toBeVisible();
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
});
