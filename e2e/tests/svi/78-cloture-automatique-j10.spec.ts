import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test('78 - Clôture (seed SVI_CLOSED) visible côté SVI', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';

  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText(/Date de fin d'inspection|Clôturer la fiche/i).first()).toBeVisible({
    timeout: 10000,
  });
});
