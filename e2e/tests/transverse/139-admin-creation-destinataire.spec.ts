import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 139 — Un admin Zacharie pré-enregistre un destinataire (commerce de détail, cantine,
// association caritative, repas de chasse) depuis /app/admin/add-entity, avec le même formulaire
// que le chasseur : qualité, raison sociale, SIRET, représentant, adresse.
// La création passe par api-express/src/utils/create-destinataire.ts, qui crée aussi le compte du
// représentant et lui envoie une invitation.

test.beforeEach(async ({ page }) => {
  await resetDb();
  // Le champ « Raison Sociale » interroge l'annuaire des entreprises (API externe) : on le neutralise
  // pour que le test ne dépende pas du réseau ni des résultats réels.
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminAddEntity(page: Parameters<typeof connectWith>[0]) {
  await connectWith(page, 'admin@example.fr');
  // le login renvoie l'admin sur son espace chasseur : on attend cette page avant d'ouvrir /admin,
  // sinon la navigation part pendant la redirection et ProConnect reçoit un `redirect` imbriqué
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/add-entity');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fadd-entity/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/add-entity/, { timeout: 10000 });
}

// on clique le label DSFR : il recouvre l'input radio, qui n'est pas cliquable directement
async function cocher(page: Page, label: string) {
  const option = page.getByText(label);
  await option.scrollIntoViewIfNeeded();
  await option.click();
}

// la raison sociale est un react-select créable qui interroge l'annuaire : l'option « Ajouter »
// n'apparaît qu'une fois la recherche terminée, on l'attend avant de la choisir
async function creerRaisonSociale(page: Page, raisonSociale: string) {
  const input = page.locator("[class*='raison_sociale'] input").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(raisonSociale);
  await page.getByRole('option', { name: `Ajouter "${raisonSociale}"` }).click();
}

// pour une entité déjà enregistrée, on ouvre le menu et on choisit l'option proposée
async function choisirRaisonSocialeExistante(page: Page, option: RegExp) {
  await page.locator("[class*='raison_sociale'][class*='input-container']").first().click();
  await page.getByRole('option', { name: option }).click();
}

// les champs d'adresse portent un hintText : leur label accessible contient l'indication,
// on les cible donc par leur id
const fieldIds = {
  siret: '#siret',
  email: '#email',
  nom: '#nom_de_famille',
  prenom: '#prenom',
  adresse: '#address_ligne_1',
  codePostal: '#code_postal',
  ville: '#ville',
};

test('un admin crée un commerce de détail avec son représentant', async ({ page }) => {
  await openAdminAddEntity(page);

  await cocher(page, 'Commerce de détail (boucherie, charcuterie, etc.)');

  // ce nom est absent de Zacharie : le select l'ajoute
  await creerRaisonSociale(page, 'Boucherie Zacharie E2E');

  await page.locator(fieldIds.siret).fill('12345678900011');
  await page.locator(fieldIds.email).fill('boucherie-e2e@example.fr');
  await page.locator(fieldIds.nom).fill('Bernard');
  await page.locator(fieldIds.prenom).fill('Louis');
  await page.locator(fieldIds.adresse).fill('3 rue des Halles');
  await page.locator(fieldIds.codePostal).fill('34000');
  await page.locator(fieldIds.ville).fill('Montpellier');
  await page.locator(fieldIds.ville).blur();

  await page.getByRole('button', { name: 'Créer' }).click();

  await expect(page).toHaveURL(/\/app\/admin\/entity\/[^/]+$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Boucherie Zacharie E2E' })).toBeVisible({
    timeout: 10000,
  });
});

test('le formulaire destinataire ne demande pas de représentant pour un ETG', async ({ page }) => {
  await openAdminAddEntity(page);

  await cocher(page, 'Etablissement de Traitement du Gibier sauvage');

  // un ETG garde le formulaire historique : une simple raison sociale, aucun représentant
  await expect(page.locator(fieldIds.email)).toBeHidden();
  await creerRaisonSociale(page, 'ETG Zacharie E2E');
  await page.getByRole('button', { name: 'Créer' }).click();

  await expect(page).toHaveURL(/\/app\/admin\/entity\/[^/]+$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'ETG Zacharie E2E' })).toBeVisible({ timeout: 10000 });
});

test('un destinataire déjà enregistré est signalé au lieu d’être dupliqué', async ({ page }) => {
  await openAdminAddEntity(page);

  // on crée d'abord le commerce, puis on revient sur le formulaire avec la même raison sociale
  await cocher(page, 'Commerce de détail (boucherie, charcuterie, etc.)');
  await creerRaisonSociale(page, 'Boucherie Doublon E2E');
  await page.locator(fieldIds.email).fill('doublon-e2e@example.fr');
  await page.locator(fieldIds.nom).fill('Bernard');
  await page.locator(fieldIds.prenom).fill('Louis');
  await page.locator(fieldIds.adresse).fill('3 rue des Halles');
  await page.locator(fieldIds.codePostal).fill('34000');
  await page.locator(fieldIds.ville).fill('Montpellier');
  await page.locator(fieldIds.ville).blur();
  await page.getByRole('button', { name: 'Créer' }).click();
  await expect(page).toHaveURL(/\/app\/admin\/entity\/[^/]+$/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/admin/add-entity');
  await cocher(page, 'Commerce de détail (boucherie, charcuterie, etc.)');
  await choisirRaisonSocialeExistante(page, /Boucherie Doublon E2E - 34000 Montpellier/);

  await expect(page.getByText('Cette entité est déjà enregistrée dans Zacharie')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer' })).toBeDisabled();
});
