import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

// L'inspection SVI (date sans heure) le même jour que la prise en charge ETG doit apparaître après
// celle-ci dans la traçabilité, et non en premier événement de la journée.
test('142 - Traçabilité : inspection SVI après la prise en charge ETG du même jour', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/);

  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  const carcasseButton = page.getByRole('button', { name: /Daim N° MM-001-001 Mise à/ });
  await carcasseButton.scrollIntoViewIfNeeded();
  await carcasseButton.click();

  const tracabilite = page.getByRole('heading', { name: 'Traçabilité', exact: true }).locator('..');
  await expect(tracabilite).toBeVisible({ timeout: 10000 });
  await expect(tracabilite).toHaveText(
    /Prise en charge par ETG.*Inspection du service vétérinaire.*Contrôle par service vétérinaire/
  );
});
