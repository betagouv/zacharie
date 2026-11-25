import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test('142 - Traçabilité : inspection SVI après la prise en charge ETG du même jour', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  const link = page.getByRole('link', { name: feiId });
  await expect(link).toBeVisible({ timeout: 15000 });
  await link.click();

  const carcasseButton = page.getByRole('button', { name: /Daim N° MM-001-001/ });
  await carcasseButton.scrollIntoViewIfNeeded();
  await carcasseButton.click();

  const tracabilite = page
    .getByRole('dialog')
    .getByRole('heading', { name: 'Traçabilité', exact: true })
    .locator('..');
  await expect(tracabilite).toBeVisible({ timeout: 10000 });
  await expect(tracabilite).toHaveText(
    /Prise en charge par ETG.*Inspection du service vétérinaire.*Contrôle par service vétérinaire/
  );
});
