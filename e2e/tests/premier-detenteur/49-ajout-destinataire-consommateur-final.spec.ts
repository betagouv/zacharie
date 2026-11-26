import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { openVenteDon, venteDonModal, creerDestinataire } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const feiId = 'ZACH-20250707-QZ6E0-155242';

test.beforeEach(async ({ page }) => {
  await resetDb('PREMIER_DETENTEUR');
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await openVenteDon(page);
  await creerDestinataire(page, 'Jean Dupont');
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
  const villeSuggestion = modal.getByRole('button', { name: /75015 PARIS/i }).first();
  await villeSuggestion.scrollIntoViewIfNeeded();
  await villeSuggestion.click();
}

async function enregistrerPartenaire(page: Page) {
  const submit = venteDonModal(page)
    .locator('#partenaire_data_form')
    .getByRole('button', { name: 'Enregistrer', exact: true });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
}

test('Un particulier ajouté comme destinataire est nommé par son représentant', async ({ page }) => {
  const modal = venteDonModal(page);

  const particulier = modal.getByText('Un particulier', { exact: true });
  await particulier.scrollIntoViewIfNeeded();
  await particulier.click();

  await expect(modal.locator("[class*='raison_sociale'] input")).toHaveCount(0);
  await expect(modal.locator('#partenaire-nouveau-qualite_du_destinataire')).toHaveCount(0);
  await expect(modal.locator('#partenaire_data_form input[name="siret"]')).toHaveCount(0);

  await remplirRepresentantEtAdresse(page);
  await enregistrerPartenaire(page);

  await expect(modal.getByText('Ajouter un destinataire')).toBeHidden({ timeout: 15000 });
  await expect(modal.getByPlaceholder('Tapez le nom du destinataire')).toHaveValue(/^Jean Dupont/, {
    timeout: 10000,
  });
});

test('Un destinataire professionnel exige une raison sociale', async ({ page }) => {
  const modal = venteDonModal(page);

  const qualite = modal.locator('#partenaire-nouveau-qualite_du_destinataire');
  await qualite.scrollIntoViewIfNeeded();
  await qualite.fill('boucherie');

  const effacerRaisonSociale = modal.locator("[class*='raison_sociale__clear-indicator']");
  await effacerRaisonSociale.scrollIntoViewIfNeeded();
  await effacerRaisonSociale.click();
  await expect(modal.locator("[class*='raison_sociale__single-value']")).toHaveCount(0);

  await remplirRepresentantEtAdresse(page);

  const requetesCreation: Array<string> = [];
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/entite/partenaire')) {
      requetesCreation.push(request.url());
    }
  });
  const alertes: Array<string> = [];
  page.once('dialog', (dialog) => {
    alertes.push(dialog.message());
    void dialog.dismiss();
  });
  await enregistrerPartenaire(page);
  await expect.poll(() => alertes).toEqual(['Veuillez renseigner la raison sociale']);

  await expect(modal.locator('#partenaire_data_form input:invalid')).toHaveCount(0);
  await expect(modal.getByText('Ajouter un destinataire')).toBeVisible();
  expect(requetesCreation).toHaveLength(0);
});
