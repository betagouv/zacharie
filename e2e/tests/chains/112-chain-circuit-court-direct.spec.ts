import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(120_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Chain circuit court : PD → Commerce de détail (sans ETG)', async ({ page }) => {
  test.setTimeout(120_000);
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: /Commerce de Détail 1/i });
  const transmettreBtn = page.getByRole('button', { name: 'Transmettre' });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Commerce de Détail 1 a été notifié/i).first()).toBeVisible({
    timeout: 15000,
  });

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'commerce-de-detail@example.fr');
  await expect(page).toHaveURL(/\/app\/circuit-court/);
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
