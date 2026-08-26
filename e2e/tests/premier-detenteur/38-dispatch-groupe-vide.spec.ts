import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  ajouterVenteDon,
  openVenteDon,
  selectDestinataire,
  allerAEtape,
  etapeCourante,
  venteDonModal,
  carcassesRetenues,
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

test('Vente / don sans carcasse — « Suivant » reste désactivé', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Vente / don 1 : ETG 1, toutes les carcasses.
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Vente / don 2 : aucune carcasse reprise à l'ETG 1.
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 2 - 75000 Paris (');
  await allerAEtape(page, 'Carcasses');

  await expect(carcassesRetenues(page)).toHaveCount(0);
  await expect(venteDonModal(page).getByRole('button', { name: 'Suivant', exact: true })).toBeDisabled();
  await expect(etapeCourante(page)).toContainText('Carcasses');
});
