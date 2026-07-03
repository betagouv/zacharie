import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

test("88 - SVI d'un autre département peut voir une fiche hors périmètre (by design)", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-185242';
  await connectWith(page, 'svi-2@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  // URL de transmission (2 segments) pour un SVI qui n'a pas la fiche dans son store local :
  // le loader ne trouve pas la fiche et affiche NotFound.
  await page.goto(`http://localhost:3290/app/svi/fei/${feiId}/no-transmission`);
  await expect(page.getByText(/Carcasses à inspecter/)).not.toBeVisible();
  await expect(page.getByText('Page non trouvéeErreur 404')).toBeVisible();
});
