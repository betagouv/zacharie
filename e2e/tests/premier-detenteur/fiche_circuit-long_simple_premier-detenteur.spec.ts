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
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Pas de stockage - Transporter les carcasses soi-même', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible();
  await expect(page.getByRole('link', { name: feiId })).toContainText('À compléter');
  await expect(page.getByRole('link', { name: feiId })).toContainText('chassenard');
  await expect(page.getByRole('link', { name: feiId })).toContainText('10 pigeons');
  await expect(page.getByRole('link', { name: feiId })).toContainText('3 daims');
  await page.getByRole('link', { name: feiId }).click();
  // L'examinateur désigne directement le premier détenteur : plus d'étape « prendre en charge »,
  // le PD arrive directement sur la fiche éditable.
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003 Mise à' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByLabel('Daim - N° MM-001-001').getByText('Anomalies abats')).toBeVisible();
  await expect(page.getByText('Abcès - Système respiratoire (trachée, poumons)')).toBeVisible();
  await expect(page.getByLabel('Daim - N° MM-001-001').getByText('Prélevé à')).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Chasse du 07/07/25' })).toBeVisible();
  await expect(page.getByLabel('Daim - N° MM-001-001').getByText('Début de la chasse')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await expect(page.getByText('Abcès unique - Externe')).toBeVisible();
  await page.getByRole('listitem').filter({ hasText: 'Fermer' }).getByRole('button').click();
  await page.getByRole('button', { name: 'Pigeons (10) N° MM-001-003 Mise à' }).click();
  await page.getByLabel('Pigeons - N° MM-001-').getByTitle('Fermer').click();

  await expect(page.getByText('Validation par le premier détenteur')).toBeVisible();
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  // Validation au niveau du champ : les erreurs ne sont révélées qu'au clic sur Enregistrer.
  await venteDonModal(page).getByRole('button', { name: 'Enregistrer', exact: true }).click();
  await expect(page.getByText('Veuillez indiquer le mode de transport des carcasses')).toBeVisible();
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  const transmettreBtn = page.getByRole('button', { name: /^Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1 a été notifié/i).first()).toBeVisible({ timeout: 10000 });
});

test('Stockage - Transporter les carcasses soi-même', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'ccg');
  await venteDonModal(page).getByRole('button', { name: 'Renseigner ma chambre froide' }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole('textbox', { name: "Numéro d'identification" }).fill('CCG-01');
  await page.getByRole('button', { name: 'Ajouter cette chambre froide' }).click();
  // La CCG fraîchement créée est sélectionnée automatiquement
  await expect(page.getByText('CCG Chasseurs - CCG-01')).toBeVisible();
  await remplirDateMaintenant(page);
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await remplirDateMaintenant(page);
  await enregistrerVenteDon(page);

  const transmettreBtn = page.getByRole('button', { name: /^Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });
});

test('Stockage - Le transport est réalisé par un collecteur professionnel', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris (');
  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'ccg');
  await venteDonModal(page).getByRole('button', { name: 'Renseigner ma chambre froide' }).click();
  await page.getByText("Oui, ma chambre froide a un numéro d'identification").click();
  await page.getByRole('textbox', { name: "Numéro d'identification" }).fill('CCG-01');
  await page.getByRole('button', { name: 'Ajouter cette chambre froide' }).click();
  // La CCG fraîchement créée est sélectionnée automatiquement
  await expect(page.getByText('CCG Chasseurs - CCG-01')).toBeVisible();
  await remplirDateMaintenant(page);
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'collecteur');
  await enregistrerVenteDon(page);

  const transmettreBtn = page.getByRole('button', { name: /^Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });
});
