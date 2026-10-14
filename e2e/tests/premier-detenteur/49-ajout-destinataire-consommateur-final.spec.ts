import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { openVenteDon, venteDonModal } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const feiId = 'ZACH-20250707-QZ6E0-155242';

test.beforeEach(async ({ page }) => {
  await resetDb('PREMIER_DETENTEUR');
  // Le champ « Raison Sociale » interroge l'annuaire des entreprises (API externe) : on le neutralise
  // pour que le test ne dépende pas du réseau ni des résultats réels.
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  const hint = venteDonModal(page).getByText('Ajoutez-le en cliquant ici');
  await hint.scrollIntoViewIfNeeded();
  await hint.click();
  await expect(venteDonModal(page).getByText('Ajouter un destinataire')).toBeVisible({ timeout: 10000 });
});

async function remplirRepresentantEtAdresse(page: Page) {
  const modal = venteDonModal(page);
  const champs: Array<[string, string]> = [
    ['#partenaire-nouveau-email', 'particulier@test.fr'],
    ['#partenaire-nouveau-nom_de_famille', 'Dupont'],
    ['#partenaire-nouveau-prenom', 'Jean'],
    ['#partenaire-nouveau-address_ligne_1', '12 rue du Commerce'],
    ['#partenaire-nouveau-code_postal', '75015'],
  ];
  for (const [selector, value] of champs) {
    const input = modal.locator(selector);
    await input.scrollIntoViewIfNeeded();
    await input.fill(value);
  }
  // InputVille affiche un autocomplete basé sur le code postal : on sélectionne la suggestion.
  const villeSuggestion = modal.getByRole('button', { name: /75015 PARIS/i }).first();
  await villeSuggestion.scrollIntoViewIfNeeded();
  await villeSuggestion.click();
}

// Le formulaire inline a son propre bouton « Enregistrer », distinct de celui de la modale vente / don.
async function enregistrerPartenaire(page: Page) {
  const submit = venteDonModal(page)
    .locator('#partenaire_data_form')
    .getByRole('button', { name: 'Enregistrer', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
}

test('Un consommateur final ajouté comme destinataire est nommé par son représentant', async ({ page }) => {
  const modal = venteDonModal(page);

  const consommateurFinal = modal.getByText('Consommateur final', { exact: true });
  await consommateurFinal.scrollIntoViewIfNeeded();
  await consommateurFinal.click();

  // Pas de raison sociale ni de SIRET pour un consommateur final
  await expect(modal.locator("[class*='raison_sociale'] input")).toHaveCount(0);
  await expect(modal.locator('#partenaire-nouveau-siret')).toHaveCount(0);

  await remplirRepresentantEtAdresse(page);
  await enregistrerPartenaire(page);

  // Le formulaire inline disparaît et le consommateur final est sélectionné comme prochain détenteur
  await expect(modal.getByText('Ajouter un destinataire')).toBeHidden({ timeout: 15000 });
  await expect(modal.locator("[class*='select-prochain-detenteur']").getByText('Jean Dupont')).toBeVisible({
    timeout: 10000,
  });
});

test("Un destinataire autre qu'un consommateur final exige une raison sociale", async ({ page }) => {
  const modal = venteDonModal(page);

  const commerceDeDetail = modal.getByText('Commerce de détail (boucherie, charcuterie, etc.)');
  await commerceDeDetail.scrollIntoViewIfNeeded();
  await commerceDeDetail.click();

  await remplirRepresentantEtAdresse(page);

  const requetesCreation: Array<string> = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/entite/partenaire')) {
      requetesCreation.push(request.url());
    }
  });
  // La raison sociale (liste déroulante) n'est pas validée par le navigateur : le formulaire bloque
  // l'envoi avec une alerte
  const alerte = page.waitForEvent('dialog');
  await enregistrerPartenaire(page);
  const dialog = await alerte;
  expect(dialog.message()).toBe('Veuillez renseigner la raison sociale');
  await dialog.dismiss();

  await expect(modal.locator('#partenaire_data_form input:invalid')).toHaveCount(0);
  await expect(modal.getByText('Ajouter un destinataire')).toBeVisible();
  expect(requetesCreation).toHaveLength(0);
});
