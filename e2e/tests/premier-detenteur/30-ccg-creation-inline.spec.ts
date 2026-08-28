import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  selectDestinataire,
  allerAEtape,
  choisirStockage,
  choisirTransport,
  remplirDateMaintenant,
  enregistrerVenteDon,
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

test('Création CCG inline depuis le formulaire de transmission', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'ccg');

  // Le PD n'a aucune CCG : la création se fait en ligne dans l'étape Stockage.
  await venteDonModal(page).getByRole('button', { name: 'Renseigner ma chambre froide' }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole('textbox', { name: "Numéro d'identification" }).fill('CCG-01');
  await page.getByRole('button', { name: 'Ajouter cette chambre froide' }).click();

  // La CCG fraîchement créée est sélectionnée automatiquement
  await expect(page.getByText('CCG Chasseurs - CCG-01')).toBeVisible({ timeout: 10000 });

  // Date de dépôt puis transport
  await remplirDateMaintenant(page);
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await remplirDateMaintenant(page);
  await enregistrerVenteDon(page);

  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });
});
