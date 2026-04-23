import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test('97 - Circuit court : re-transmission à un autre acteur interdite', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  // Aucun sélecteur "prochain détenteur" ni bouton "Transmettre"
  await expect(page.locator("[class*='select-prochain-detenteur']")).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Transmettre la fiche/i })).toHaveCount(0);

  // Pas de possibilité de changer le statut owner vers un autre acteur :
  // l'UI doit rester limitée à la consultation + prise en charge éventuelle.
  // TODO: ajouter assertion API (POST /fei ... fei_next_owner_role=ETG → 403) si endpoint exposé
});
