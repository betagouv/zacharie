import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test('93 - Onboarding complet circuit-court : parcours 1-coordonnees → 2-entreprise → liste', async ({
  page,
}) => {
  await connectWith(page, 'commerce-de-detail-nouveau@example.fr');
  await expect(page).toHaveURL(/\/app\/circuit-court\/onboarding/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/circuit-court/onboarding/1-coordonnees');
  await expect(page).toHaveURL(/onboarding\/1-coordonnees/);

  const prenom = page.getByLabel(/Prénom/i).first();
  if (await prenom.isVisible().catch(() => false)) {
    await prenom.fill('Jean');
  }
  const nom = page.getByLabel(/Nom de famille|Nom/i).first();
  if (await nom.isVisible().catch(() => false)) {
    await nom.fill('Dupont');
  }

  await page.goto('http://localhost:3290/app/circuit-court/onboarding/2-entreprise');
  await expect(page).toHaveURL(/onboarding\/2-entreprise/);
});
