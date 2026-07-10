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

test('Compte en attente + numero_cfei : peut créer et préparer ses fiches', async ({ page }) => {
  await connectWith(page, 'examinateur-en-attente-validation@example.fr');
  await page.goto('http://localhost:3290/app/chasseur');

  await expect(page.getByText('Compte en attente de validation').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vous pouvez créer et préparer vos fiches').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Vous pourrez consulter et recevoir')).toHaveCount(0);
});

test('Compte en attente sans numero_cfei : ne pourra transmettre qu’une fois validé', async ({ page }) => {
  await connectWith(page, 'premier-detenteur-en-attente-validation@example.fr');
  await page.goto('http://localhost:3290/app/chasseur');

  await expect(page.getByText('Compte en attente de validation').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Vous pourrez consulter et recevoir').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Vous pouvez créer et préparer vos fiches')).toHaveCount(0);
});
