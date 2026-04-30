import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('SVI_CLOSED');
});

test('Fiche clôturée SVI — côté PD : lecture seule, décision visible', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  const link = page.getByRole('link', { name: feiId });
  await expect(link).toBeVisible({ timeout: 15000 });
  await link.click();

  // Read-only: no Transmettre or Prendre en charge buttons
  await expect(page.getByRole('button', { name: /Prendre en charge/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Transmettre/i })).toHaveCount(0);

  // SVI decision is visible (svi_carcasse_status = ACCEPTE for all 4 carcasses per SVI_CLOSED seed)
  await expect(page.getByText(/accept/i).first()).toBeVisible({ timeout: 10000 });
});
