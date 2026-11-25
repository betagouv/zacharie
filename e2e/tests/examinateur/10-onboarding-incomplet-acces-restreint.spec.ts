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
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Onboarding incomplet — ChasseurDeactivated affiché, accès fiche bloqué', async ({ page }) => {
  await connectWith(page, 'examinateur-onboarding@example.fr');

  await page.goto('http://localhost:3290/app/chasseur');

  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });

  await page.goto('http://localhost:3290/app/chasseur/fei/ZACH-FAKE');
  await expect(page.getByText(/compléter votre profil/i).first()).toBeVisible({ timeout: 10000 });
});
