import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

test('ETG voit ses carcasses dans la vue agrégée', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/carcasses');
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/);

  await expect(page.getByText('MM-001-001').first()).toBeVisible();
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003').first()).toBeVisible();
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
});
