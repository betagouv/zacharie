import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG_ALL_REFUSED_TO_SVI');
});

test('87 - Fiche sans carcasse à inspecter (toutes refusées par ETG)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-225242';
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/, { timeout: 15000 });

  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();

  await expect(page.getByText(/Carcasses à inspecter \(0\)/).first()).toBeVisible({ timeout: 10000 });
});
