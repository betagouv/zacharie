import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  ajouterVenteDon,
  openVenteDon,
  selectDestinataire,
  etapeSuivante,
  allerAEtape,
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

test('Vente / don sans carcasse — validation empêche de l’enregistrer', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Vente / don 1 : ETG 1, toutes les carcasses.
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Vente / don 2 : aucune carcasse reprise à l'ETG 1.
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 2 - 75000 Paris (');
  await allerAEtape(page, 'Carcasses');
  await etapeSuivante(page);

  // On reste bloqué sur l'étape Carcasses, avec le message d'erreur.
  await expect(venteDonModal(page).getByText(/Veuillez sélectionner au moins une carcasse/i)).toBeVisible();
  await expect(etapeCourante(page)).toContainText('Carcasses');
});
