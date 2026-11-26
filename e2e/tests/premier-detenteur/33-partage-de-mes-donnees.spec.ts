import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.describe('33a - empty state', () => {
  test.beforeEach(async () => {
    await resetDb('PREMIER_DETENTEUR');
  });

  test("Partage de mes données — état vide : page se charge sans bloc d'autorisation", async ({ page }) => {
    await connectWith(page, 'premier-detenteur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
    await page.goto('http://localhost:3290/app/chasseur/profil/partage-de-mes-donnees');

    await expect(page.getByRole('heading', { name: /Partage de mes données/i })).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByRole('heading', { name: /Votre clé dédiée/i })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: /Accès à votre compte personnel/i })).toHaveCount(0);
  });
});

test.describe('33b - active state', () => {
  test.beforeEach(async () => {
    await resetDb('PREMIER_DETENTEUR_WITH_PARTAGE');
  });

  test('Partage de mes données — avec approbation seedée : bloc compte personnel visible', async ({
    page,
  }) => {
    await connectWith(page, 'premier-detenteur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
    await page.goto('http://localhost:3290/app/chasseur/profil/partage-de-mes-donnees');

    await expect(page.getByRole('heading', { name: /Partage de mes données/i })).toBeVisible({
      timeout: 10000,
    });

    await expect(page.getByRole('heading', { name: /Accès à votre compte personnel/i })).toBeVisible({
      timeout: 10000,
    });
    await expect(page.getByText(/Test API Key Partage PD/i).first()).toBeVisible();
  });
});
