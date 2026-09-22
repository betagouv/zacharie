import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 139 — Un admin Zacharie pré-enregistre un destinataire (commerce de détail, cantine,
// association caritative, repas de chasse) depuis /app/admin/add-entity, avec le même formulaire
// que le chasseur : qualité, raison sociale, SIRET, représentant, adresse.
// La création passe par api-express/src/utils/create-destinataire.ts, qui crée aussi le compte du
// représentant et lui envoie une invitation.

test.beforeEach(async () => {
  await resetDb();
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminAddEntity(page: Parameters<typeof connectWith>[0]) {
  await connectWith(page, 'admin@example.fr');
  await page.goto('http://localhost:3290/app/admin/add-entity');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fadd-entity/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/add-entity/, { timeout: 10000 });
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

  await page.getByRole('radio', { name: 'Commerce de détail (boucherie, charcuterie, etc.)' }).check();

  // la raison sociale est un select créable : on saisit un nom absent de Zacharie et on l'ajoute
  await page.locator('#raison_sociale').fill('Boucherie Zacharie E2E');
  await page.locator('.raison_sociale__menu').getByText('Ajouter "Boucherie Zacharie E2E"').click();

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

  await page.getByRole('radio', { name: 'Etablissement de Traitement du Gibier sauvage' }).check();

  // un ETG garde le formulaire historique : une simple raison sociale, aucun représentant
  await expect(page.locator(fieldIds.email)).toBeHidden();
  await page.getByLabel('Raison Sociale', { exact: true }).fill('ETG Zacharie E2E');
  await page.getByRole('button', { name: 'Créer' }).click();

  await expect(page).toHaveURL(/\/app\/admin\/entity\/[^/]+$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'ETG Zacharie E2E' })).toBeVisible({ timeout: 10000 });
});

test('un destinataire déjà enregistré est signalé au lieu d’être dupliqué', async ({ page }) => {
  await openAdminAddEntity(page);

  // on crée d'abord le commerce, puis on revient sur le formulaire avec la même raison sociale
  await page.getByRole('radio', { name: 'Commerce de détail (boucherie, charcuterie, etc.)' }).check();
  await page.locator('#raison_sociale').fill('Boucherie Doublon E2E');
  await page.locator('.raison_sociale__menu').getByText('Ajouter "Boucherie Doublon E2E"').click();
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
  await page.getByRole('radio', { name: 'Commerce de détail (boucherie, charcuterie, etc.)' }).check();
  await page.locator('#raison_sociale').fill('Boucherie Doublon E2E');
  await page.locator('.raison_sociale__menu').getByText('Boucherie Doublon E2E - 34000 Montpellier').click();

  await expect(page.getByText('Cette entité est déjà enregistrée dans Zacharie')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer' })).toBeDisabled();
});
