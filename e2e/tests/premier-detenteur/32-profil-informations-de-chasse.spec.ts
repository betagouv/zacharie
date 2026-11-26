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
  await resetDb('PREMIER_DETENTEUR');
});

test('32a - Profil associations de chasse : page se charge et association seedée visible', async ({
  page,
}) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/associations-de-chasse');
  await expect(page).toHaveURL(/\/profil\/associations-de-chasse/);

  await expect(page.getByText(/Association de chasseurs/i).first()).toBeVisible({ timeout: 10000 });
});

test('32c - Profil CCGs : page se charge et CCG-01 visible', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/profil/ccgs');
  await expect(page).toHaveURL(/\/profil\/ccgs/);

  const ccgVisible = page.getByText(/CCG-01|CCG Chasseurs|chambre froide/i).first();
  await expect(ccgVisible).toBeVisible({ timeout: 10000 });
});
