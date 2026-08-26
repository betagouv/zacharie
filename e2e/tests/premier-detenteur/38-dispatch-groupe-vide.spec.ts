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
  choisirRepartition,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
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

test('Une vente / un don vidé par une autre reste visible et bloque la transmission', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Vente / don 1 : ETG 1, toutes les carcasses.
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Vente / don 2 : ETG 2 les reprend toutes — l'ETG 1 se retrouve sans carcasse.
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 2 - 75000 Paris (');
  await allerAEtape(page, 'Carcasses');
  await choisirRepartition(page, 'toutes');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  // La carte ETG 1 n'est pas supprimée en silence : elle est signalée comme vide.
  await expect(page.getByText('Aucune carcasse')).toBeVisible();

  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  await expect(page.getByText(/n\u2019a plus aucune carcasse/)).toBeVisible();
  await expect(page).not.toHaveURL(/envoy/);
});
