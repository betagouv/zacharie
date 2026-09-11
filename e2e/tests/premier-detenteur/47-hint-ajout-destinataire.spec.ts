import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { openVenteDon, venteDonModal, allerAEtape, enregistrerVenteDon } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("Le hint « Ajoutez-le en cliquant ici » ouvre la création inline d'un partenaire", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await openVenteDon(page);

  // Le hint est visible à l'étape Destinataire
  const hint = venteDonModal(page).getByText('Ajoutez-le en cliquant ici');
  await expect(hint).toBeVisible({ timeout: 10000 });

  // Cliquer le hint ouvre le formulaire de création inline
  await hint.click();
  await expect(venteDonModal(page).getByText('Ajouter un destinataire')).toBeVisible({ timeout: 10000 });

  // Saisir le nom dans le champ « Raison Sociale » (creatable select) AVANT le type :
  // onCreateOption remet entityType à undefined, il faut donc choisir le type après.
  const modal = venteDonModal(page);
  const raisonSocialeInput = modal.locator("[class*='raison_sociale'] input").first();
  await raisonSocialeInput.scrollIntoViewIfNeeded();
  await raisonSocialeInput.fill('Ma Boucherie Test');
  await raisonSocialeInput.press('Enter');

  // Sélectionner le type après avoir saisi la raison sociale
  const commerceDeDetail = modal.getByText('Commerce de détail (boucherie, charcuterie, etc.)');
  await commerceDeDetail.scrollIntoViewIfNeeded();
  await commerceDeDetail.click();

  // Remplir les champs obligatoires — scrollIntoViewIfNeeded sur mobile viewport
  const email = modal.locator('#email');
  await email.scrollIntoViewIfNeeded();
  await email.fill('boucher@test.fr');

  const nom = modal.locator('#nom_de_famille');
  await nom.scrollIntoViewIfNeeded();
  await nom.fill('Dupont');

  const prenom = modal.locator('#prenom');
  await prenom.scrollIntoViewIfNeeded();
  await prenom.fill('Jean');

  const adresse = modal.locator('#address_ligne_1');
  await adresse.scrollIntoViewIfNeeded();
  await adresse.fill('12 rue du Commerce');

  const codePostal = modal.locator('#code_postal');
  await codePostal.scrollIntoViewIfNeeded();
  await codePostal.fill('75015');

  // InputVille affiche un autocomplete basé sur le code postal : on sélectionne la suggestion.
  const villeSuggestion = modal.getByRole('button', { name: /75015 PARIS/i }).first();
  await villeSuggestion.scrollIntoViewIfNeeded();
  await villeSuggestion.click();

  // Le formulaire inline a son propre bouton « Enregistrer », distinct de celui de la modale
  // vente / don : on le cible via l'id du formulaire.
  const submit = modal
    .locator('#partenaire_data_form')
    .getByRole('button', { name: 'Enregistrer', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();

  // Le formulaire inline disparaît et le partenaire créé est sélectionné comme prochain détenteur
  await expect(modal.getByText('Ajouter un destinataire')).toBeHidden({ timeout: 15000 });
  await expect(
    modal.locator("[class*='select-prochain-detenteur']").getByText('Ma Boucherie Test')
  ).toBeVisible({ timeout: 10000 });

  // Continuer le dispatch : stockage (circuit court = pas de transport)
  await allerAEtape(page, 'Stockage');
  const pasDeStockage = venteDonModal(page)
    .getByText('Pas de stockage')
    .first()
    .locator('xpath=ancestor-or-self::label[1]');
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  await enregistrerVenteDon(page);

  // Transmettre la fiche
  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/a été notifié/i).first()).toBeVisible({ timeout: 10000 });
});
