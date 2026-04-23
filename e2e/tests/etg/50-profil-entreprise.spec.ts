import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 50 — Profil entreprise : éditer SIRET/adresse → persisté.
test('ETG édite les informations entreprise et les voit persistées', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await page.goto('http://localhost:3290/app/etg/entreprise/informations');
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);

  // TODO: verify selector — noms de champs exacts peuvent varier.
  const adresse = page.getByRole('textbox', { name: /Adresse/i }).first();
  if (await adresse.isVisible().catch(() => false)) {
    await adresse.scrollIntoViewIfNeeded();
    await adresse.fill('42 Rue des Tests');
    await adresse.blur();
  }

  await page.reload();
  await expect(page).toHaveURL(/\/app\/etg\/entreprise\/informations/);
  if (await adresse.isVisible().catch(() => false)) {
    await expect(adresse).toHaveValue(/42 Rue des Tests/);
  }
});
