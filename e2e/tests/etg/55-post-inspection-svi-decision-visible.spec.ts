import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test.use({ launchOptions: { slowMo: 100 } });

test('ETG voit la décision SVI après clôture', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');

  const feiId = 'ZACH-20250707-QZ6E0-205242';
  const feiLink = page.getByRole('link', { name: new RegExp(feiId) }).first();
  await expect(feiLink).toBeVisible({ timeout: 10000 });
  await feiLink.click();

  await expect(page.getByText(/accept/i).first()).toBeVisible({ timeout: 10000 });
});
