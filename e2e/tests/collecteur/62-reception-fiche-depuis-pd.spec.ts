import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('COLLECTEUR_PRO');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 62 — Réception fiche depuis PD : liste /collecteur → ouvrir → "Prendre en charge".
test('Collecteur reçoit la fiche du PD et peut la prendre en charge', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-175242';
  await connectWith(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/collecteur');

  const link = page.getByRole('link', { name: new RegExp(feiId) });
  await expect(link).toBeVisible({ timeout: 10000 });
  await link.click();
  await expect(page).toHaveURL(new RegExp(`/app/collecteur/fei/${feiId}`));

  // Collecteur take-charge button has different text than ETG
  const takeCharge = page.getByRole('button', {
    name: /Je contrôle et transporte les carcasses|Prendre en charge/i,
  });
  await takeCharge.click();
  await expect(
    page
      .getByRole('heading', { name: /R.ception|Transport/i })
      .or(page.getByText(/Prise en charge|contrôle/i))
      .first()
  ).toBeVisible({ timeout: 10000 });
});
