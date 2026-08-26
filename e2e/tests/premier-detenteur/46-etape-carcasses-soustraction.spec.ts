import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  selectDestinataire,
  allerAEtape,
  etapePrecedente,
  etapeCourante,
  etapeSuivante,
  venteDonModal,
  carcassesRetenues,
  carcassesRetirees,
  choisirRepartition,
  retirerCarcasse,
  remettreCarcasse,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
} from '../../utils/vente-don';

// Étape « Carcasses » : on ne coche plus, on retire. Par défaut tout part chez le destinataire,
// le chasseur n'a rien à toucher dans le cas courant.
// Seed PREMIER_DETENTEUR : 4 carcasses — 3 daims (MM-001-001/002/004) + 1 lot de 10 pigeons (MM-001-003).

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const feiId = 'ZACH-20250707-QZ6E0-155242';

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

async function ouvrirEtapeCarcasses(page: Page, destinataire: string) {
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await selectDestinataire(page, destinataire);
  await allerAEtape(page, 'Carcasses');
}

test('Par défaut toutes les carcasses partent chez le destinataire', async ({ page }) => {
  await ouvrirEtapeCarcasses(page, 'ETG 1 - 75000 Paris (');

  await expect(venteDonModal(page).getByRole('radio').first()).toBeChecked();
  await expect(venteDonModal(page).getByText('Toutes mes carcasses (4)')).toBeVisible();
  // Les zones de tags n'apparaissent qu'avec « une partie seulement ».
  await expect(carcassesRetenues(page)).toHaveCount(0);

  // Rien à faire : on enchaîne directement.
  await etapeSuivante(page);
  await expect(etapeCourante(page)).toContainText('Stockage');
});

test('Retirer puis remettre une carcasse', async ({ page }) => {
  await ouvrirEtapeCarcasses(page, 'ETG 1 - 75000 Paris (');
  await choisirRepartition(page, 'partie');

  await expect(carcassesRetenues(page)).toHaveCount(4);
  await expect(carcassesRetirees(page)).toHaveCount(0);
  await expect(venteDonModal(page).getByText(/Rien pour l'instant/)).toBeVisible();

  await retirerCarcasse(page, 'Daim N° MM-001-002');
  await expect(carcassesRetenues(page)).toHaveCount(3);
  await expect(carcassesRetirees(page)).toHaveCount(1);
  await expect(venteDonModal(page).getByText('3 carcasses transmises · 1 conservée')).toBeVisible();

  await remettreCarcasse(page, 'Daim N° MM-001-002');
  await expect(carcassesRetenues(page)).toHaveCount(4);
  await expect(carcassesRetirees(page)).toHaveCount(0);
});

test('« Suivant » est désactivé quand plus aucune carcasse n’est retenue', async ({ page }) => {
  await ouvrirEtapeCarcasses(page, 'ETG 1 - 75000 Paris (');
  await choisirRepartition(page, 'partie');

  const suivant = venteDonModal(page).getByRole('button', { name: 'Suivant', exact: true });
  await expect(suivant).toBeEnabled();

  for (const nom of ['Daim N° MM-001-001', 'Daim N° MM-001-002', 'Daim N° MM-001-004']) {
    await retirerCarcasse(page, nom);
  }
  await expect(suivant).toBeEnabled();

  await retirerCarcasse(page, 'Pigeons N° MM-001-003');
  await expect(carcassesRetenues(page)).toHaveCount(0);
  await expect(suivant).toBeDisabled();

  await remettreCarcasse(page, 'Pigeons N° MM-001-003');
  await expect(suivant).toBeEnabled();
});

test('Changer de destinataire réinitialise la répartition', async ({ page }) => {
  await ouvrirEtapeCarcasses(page, 'ETG 1 - 75000 Paris (');
  await choisirRepartition(page, 'partie');
  await retirerCarcasse(page, 'Daim N° MM-001-002');
  await expect(carcassesRetirees(page)).toHaveCount(1);

  await etapePrecedente(page);
  await expect(etapeCourante(page)).toContainText('Destinataire');
  await selectDestinataire(page, 'ETG 2 - 75000 Paris (');

  await allerAEtape(page, 'Carcasses');
  await expect(venteDonModal(page).getByRole('radio').first()).toBeChecked();
  await expect(carcassesRetenues(page)).toHaveCount(0);
});

test('Les carcasses retirées restent à attribuer après validation', async ({ page }) => {
  await ouvrirEtapeCarcasses(page, 'ETG 1 - 75000 Paris (');
  await choisirRepartition(page, 'partie');
  await retirerCarcasse(page, 'Pigeons N° MM-001-003');

  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  await expect(page.getByText(/Il reste 1 lot — créer une autre vente ou un don/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Créer une autre vente ou un don/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /^Transmettre 3 carcasses sur/ })).toBeVisible();
});
