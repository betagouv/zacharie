import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('ETG_REFUSED');
});
test.use({ launchOptions: { slowMo: 100 } });

test('Un collègue voit qui, au sein de l’ETG, a pris en charge la fiche', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-215242';

  await connectWith(page, 'etg-1-bis@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();

  const tracabilite = page.getByRole('group').filter({
    has: page.getByRole('heading', { name: 'Données de traçabilité' }),
  });
  await expect(tracabilite.getByText('Prise en charge par Thomas Robert')).toBeVisible({ timeout: 10000 });
});
