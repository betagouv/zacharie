import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 134 — CompteEnAttenteValidationAlert wording depends on numero_cfei.
// A chasseur with a complete profile but activated === false lands on /app/chasseur and
// sees the "compte en attente de validation" banner. The description branches on whether
// the user has a numero_cfei (examinateur formé) or not (simple premier détenteur):
//   - with numero_cfei    → "Vous pouvez créer et préparer vos fiches, mais..."
//   - without numero_cfei → "Vous ne pourrez transmettre vos fiches qu’une fois..."

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
  // numero_cfei present → the "peut créer et préparer" wording
  await expect(page.getByText('Vous pouvez créer et préparer vos fiches').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Vous ne pourrez transmettre vos fiches')).toHaveCount(0);
});

test('Compte en attente sans numero_cfei : ne pourra transmettre qu’une fois validé', async ({ page }) => {
  await connectWith(page, 'premier-detenteur-en-attente-validation@example.fr');
  await page.goto('http://localhost:3290/app/chasseur');

  await expect(page.getByText('Compte en attente de validation').first()).toBeVisible({ timeout: 10000 });
  // numero_cfei absent → the "ne pourrez transmettre" wording, without the "créer et préparer" promise
  await expect(page.getByText('Vous ne pourrez transmettre vos fiches').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Vous pouvez créer et préparer vos fiches')).toHaveCount(0);
});
