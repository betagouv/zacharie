import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  venteDonModal,
  allerAEtape,
  choisirStockage,
  enregistrerVenteDon,
} from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

// Le seed PREMIER_DETENTEUR enregistre un seul destinataire habituel pour premier-detenteur@ :
// « Commerce de Détail 1 ». « Moi-même » (usage domestique) est toujours proposé en plus.
const feiId = 'ZACH-20250707-QZ6E0-155242';

test.beforeEach(async ({ page }) => {
  await resetDb('PREMIER_DETENTEUR');
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
});

test('Les destinataires habituels se choisissent par boutons radio', async ({ page }) => {
  const modal = venteDonModal(page);

  const commerce = modal.getByRole('radio', { name: /Commerce de Détail 1/ });
  const moiMeme = modal.getByRole('radio', { name: /^Moi-même/ });
  await expect(commerce).toBeVisible({ timeout: 10000 });
  await expect(moiMeme).toBeVisible();
  await expect(commerce).not.toBeChecked();
  await expect(moiMeme).not.toBeChecked();
  // la recherche n'est pas affichée tant qu'on ne la demande pas
  await expect(modal.getByPlaceholder('Tapez le nom du destinataire')).toHaveCount(0);

  // Les radios DSFR « rich » : le <label> est l'élément cliquable
  const commerceLabel = modal.locator(`label[for="${await commerce.getAttribute('id')}"]`);
  await commerceLabel.scrollIntoViewIfNeeded();
  await commerceLabel.click();
  await expect(commerce).toBeChecked();
  await expect(moiMeme).not.toBeChecked();

  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await enregistrerVenteDon(page);

  await expect(page.getByRole('button', { name: /Commerce de Détail 1/ }).first()).toBeVisible({
    timeout: 10000,
  });
});

test('« Envoyer à un autre destinataire » remplace les radios par la recherche', async ({ page }) => {
  const modal = venteDonModal(page);

  const autreDestinataire = modal.getByRole('button', { name: 'Envoyer à un autre destinataire' });
  await autreDestinataire.scrollIntoViewIfNeeded();
  await autreDestinataire.click();

  await expect(modal.getByRole('radio', { name: /Commerce de Détail 1/ })).toHaveCount(0);
  const recherche = modal.getByPlaceholder('Tapez le nom du destinataire');
  await expect(recherche).toBeVisible();

  await recherche.fill('etg 1');
  const resultat = modal.getByRole('button', { name: /^ETG 1 - 75000 Paris/ });
  await resultat.scrollIntoViewIfNeeded();
  await resultat.click();
  await expect(recherche).toHaveValue(/^ETG 1 - 75000 Paris/);
});
