import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  selectDestinataire,
  etapeSuivante,
  allerAEtape,
  choisirStockage,
  etapeCourante,
  venteDonModal,
} from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Stockage CCG choisi mais aucune CCG renseignée → transmission bloquée', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'ccg');

  // Le PD n'a aucune CCG : on lui propose d'en renseigner une, et il ne peut pas avancer sans.
  await expect(venteDonModal(page).getByRole('button', { name: 'Renseigner ma chambre froide' })).toBeVisible(
    { timeout: 10000 }
  );
  await etapeSuivante(page);
  await expect(etapeCourante(page)).toContainText('Stockage');
});
