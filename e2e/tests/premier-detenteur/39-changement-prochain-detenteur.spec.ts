import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  selectDestinataire,
  allerAEtape,
  etapePrecedente,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
  etapeCourante,
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

test('Changement de prochain détenteur après sélection — cohérence du formulaire', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');

  // Retour à l'étape 1 pour changer de destinataire : le stockage déjà choisi est conservé.
  await etapePrecedente(page);
  await etapePrecedente(page);
  await expect(etapeCourante(page)).toContainText('Destinataire');
  await selectDestinataire(page, 'ETG 2 - 75000 Paris (');

  await allerAEtape(page, 'Stockage');
  await expect(etapeCourante(page)).toContainText('Stockage');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  // La carte récapitule le nouveau destinataire et le stockage conservé.
  const carte = page.getByRole('button', { name: /ETG 2/ }).first();
  await expect(carte).toBeVisible();
  await expect(carte).toContainText('Pas de stockage');
});
