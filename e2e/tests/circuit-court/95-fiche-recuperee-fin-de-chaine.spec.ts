import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

/**
 * Circuit court = terminal. Après prise en charge, pas de bouton "Transmettre" ni
 * de sélecteur de prochain détenteur.
 */
test("95 - Fiche circuit court = fin de chaîne : pas d'action de transmission", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  // Pas de "Transmettre la fiche"
  await expect(page.getByRole('button', { name: /Transmettre la fiche/i })).toHaveCount(0);
  // Pas de sélecteur prochain détenteur
  await expect(page.locator("[class*='select-prochain-detenteur']")).toHaveCount(0);
});
