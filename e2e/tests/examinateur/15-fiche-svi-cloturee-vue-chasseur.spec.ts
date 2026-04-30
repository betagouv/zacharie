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

test('Fiche clôturée SVI — vue chasseur : décision finale visible, aucune action possible', async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-205242';
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const link = page.getByRole('link', { name: feiId });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();

  // No action buttons
  await expect(page.getByRole('button', { name: /Prendre en charge/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Transmettre/i })).toHaveCount(0);

  // Carcasse should show SVI decision "Acceptée" or "accepté"
  await expect(page.getByText(/accepté/i).first()).toBeVisible({ timeout: 10000 });
});
