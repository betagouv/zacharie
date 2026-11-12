import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 172 — Un collègue du même ETG voit QUI, au sein de l'ETG, a pris en charge la fiche.
// Thomas Robert (etg-1@) a pris en charge et refusé toutes les carcasses (seed ETG_REFUSED). Paul
// (etg-1-bis@, même ETG) ouvre la fiche : le parcours de la fiche nomme Thomas. Thomas n'est ni
// propriétaire ni destinataire de la fiche : seul `intermediaire_user_id` le fait charger par GET /carcasse.

test.beforeAll(async () => {
  await resetDb('ETG_REFUSED');
});
test.use({ launchOptions: { slowMo: 100 } });

test('Un collègue voit qui, au sein de l’ETG, a pris en charge la fiche', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-215242';

  await connectWith(page, 'etg-1-bis@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();

  const tracabilite = page.getByRole('group').filter({
    has: page.getByRole('heading', { name: 'Données de traçabilité' }),
  });
  await expect(tracabilite.getByText('Prise en charge par Thomas Robert')).toBeVisible({ timeout: 10000 });
});
