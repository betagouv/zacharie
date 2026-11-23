import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import {
  openVenteDon,
  venteDonModal,
  allerAEtape,
  enregistrerVenteDon,
  creerDestinataire,
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

test("« Créer « … » » depuis la recherche ouvre l'ajout d'un destinataire, raison sociale préremplie", async ({
  page,
}) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  // Le champ « Raison Sociale » interroge l'annuaire des entreprises (API externe) : on simule sa réponse
  // pour que le test ne dépende pas du réseau ni des résultats réels.
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            nom_complet: 'MA BOUCHERIE TEST SARL',
            matching_etablissements: [
              {
                siret: '12345678900012',
                adresse: '12 RUE DU COMMERCE 75015 PARIS',
                code_postal: '75015',
                libelle_commune: 'PARIS',
              },
            ],
          },
        ],
      },
    })
  );
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await openVenteDon(page);
  await creerDestinataire(page, 'Ma Boucherie Test');

  // Le destinataire est un professionnel par défaut
  const modal = venteDonModal(page);
  await expect(modal.getByRole('radio', { name: 'Un professionnel' })).toBeChecked();

  // La raison sociale reprend le nom tapé dans la recherche, et l'annuaire
  // des entreprises est interrogé tout de suite : ses résultats s'affichent sans rien retaper
  // le nom est dans le champ de saisie, curseur à la fin : on peut continuer à taper
  const raisonSociale = modal.locator('#raison_sociale');
  await expect(raisonSociale).toBeFocused();
  await expect(raisonSociale).toHaveValue('Ma Boucherie Test');
  await expect
    .poll(() => raisonSociale.evaluate((input: HTMLInputElement) => input.selectionStart))
    .toBe('Ma Boucherie Test'.length);
  const resultatAnnuaire = page.getByRole('option', { name: /MA BOUCHERIE TEST SARL - 75015 PARIS/ });
  await expect(resultatAnnuaire).toBeVisible({ timeout: 10000 });
  await resultatAnnuaire.click();

  // Choisir le résultat de l'annuaire remplit l'adresse ; le SIRET n'est plus saisi : il est affiché
  // sous la raison sociale et envoyé en caché
  await expect(modal.locator("[class*='raison_sociale__single-value']")).toHaveText('MA BOUCHERIE TEST SARL');
  await expect(modal.getByText('SIRET : 12345678900012')).toBeVisible();
  await expect(modal.getByRole('textbox', { name: 'SIRET' })).toHaveCount(0);
  await expect(modal.locator('#partenaire_data_form input[name="siret"]')).toHaveValue('12345678900012');
  await expect(modal.locator('#partenaire-nouveau-address_ligne_1')).toHaveValue('12 RUE DU COMMERCE');

  // La qualité du destinataire est un champ libre, avec des raccourcis qui le remplissent
  await expect(modal.getByText('Commerce de détail (boucherie, restaurant, etc.)')).toHaveCount(0);
  const qualite = modal.locator('#partenaire-nouveau-qualite_du_destinataire');
  const presetBoucherie = modal.getByRole('button', { name: 'Boucherie', exact: true });
  await presetBoucherie.scrollIntoViewIfNeeded();
  await presetBoucherie.click();
  await expect(qualite).toHaveValue('Boucherie');

  // Remplir les champs obligatoires — scrollIntoViewIfNeeded sur mobile viewport
  const email = modal.locator('#partenaire-nouveau-email');
  await email.scrollIntoViewIfNeeded();
  await email.fill('boucher@test.fr');

  const nom = modal.locator('#partenaire-nouveau-nom_de_famille');
  await nom.scrollIntoViewIfNeeded();
  await nom.fill('Dupont');

  const prenom = modal.locator('#partenaire-nouveau-prenom');
  await prenom.scrollIntoViewIfNeeded();
  await prenom.fill('Jean');

  // Le formulaire inline a son propre bouton « Enregistrer », distinct de celui de la modale
  // vente / don : on le cible via l'id du formulaire.
  const submit = modal
    .locator('#partenaire_data_form')
    .getByRole('button', { name: 'Enregistrer', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();

  // Le formulaire inline disparaît et le partenaire créé est sélectionné comme prochain détenteur
  await expect(modal.getByText('Ajouter un destinataire')).toBeHidden({ timeout: 15000 });
  await expect(modal.getByPlaceholder('Tapez le nom du destinataire')).toHaveValue(
    /^MA BOUCHERIE TEST SARL/,
    {
      timeout: 10000,
    }
  );

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
