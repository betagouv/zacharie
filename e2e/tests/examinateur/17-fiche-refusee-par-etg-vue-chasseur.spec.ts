import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 1000 },
});

test.beforeAll(async () => {
  await resetDb('ETG_REFUSED');
});

test('Fiche refusée intégralement par ETG — chasseur voit le statut de refus pour chaque carcasse', async ({
  page,
}) => {
  // Fiche is in terminal "all refused at ETG" state: current owner = ETG, intermediaire_closed_at set,
  // CarcasseIntermediaire with refus = "Présence de souillures". PD still sees it because they
  // are premier_detenteur_user_id (and created_by_user_id via the examinateur).
  const feiId = 'ZACH-20250707-QZ6E0-215242';
  await connectWith(page, 'premier-detenteur@example.fr');

  const link = page.getByRole('link', { name: feiId });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();

  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/refusée|refusé|souillures/i).first()).toBeVisible({ timeout: 10000 });
});
