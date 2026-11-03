import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import dayjs from 'dayjs';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { dateApprobationDuJour } from '../../utils/date-approbation';
import { gotoBacASable, resetBacASable } from '../../utils/bac-a-sable';

// Bac à sable de l'API (api-playground) : une application tierce utilise la clé API tierce partie
// seedée (`test-private-key-user`) pour lier un compte Zacharie, créer des fiches pré-remplies
// (intégrées dans la page ou dans un nouvel onglet), recevoir les webhooks et lire les fiches.
// Les tests s'enchaînent : chacun part de l'état laissé par le précédent.

test.use({ launchOptions: { slowMo: 100 } });
test.describe.configure({ mode: 'serial' });

const COMPTE_BAC_A_SABLE = 'editeur@bac-a-sable.fr';
const MOT_DE_PASSE = 'secret-secret';
const CLE_API = 'test-private-key-user';
const COMPTE_ZACHARIE = 'examinateur@example.fr';
const AUJOURD_HUI = dayjs().format('YYYY-MM-DD');

test.beforeAll(async () => {
  await resetDb('API_BAC_A_SABLE');
  await resetBacASable();
});

async function seConnecterAuBacASable(page: Page) {
  await gotoBacASable(page, '/connexion');
  await page.getByLabel('Email', { exact: true }).fill(COMPTE_BAC_A_SABLE);
  await page.getByLabel(/Mot de passe/).fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: "Tester l'API Zacharie" })).toBeVisible({ timeout: 10000 });
}

async function remplirLaFiche(page: Page, bracelets: [string, string]) {
  await page.getByLabel('Date de mise à mort').fill(AUJOURD_HUI);
  await page.getByLabel('Commune de mise à mort').fill('03510 CHASSENARD');
  await page
    .getByLabel('Heure de mise à mort de la première carcasse')
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page
    .getByLabel("Heure d'éviscération de la dernière carcasse")
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByLabel('Numéro de marquage').first().fill(bracelets[0]);
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Numéro de marquage').nth(1).fill(bracelets[1]);
  await page.getByLabel('Espèce', { exact: true }).nth(1).selectOption('Sanglier');
}

// La fiche est créée dans Zacharie puis synchronisée : on la relit par l'API (étape 3 du bac à sable)
async function attendreLaFicheDansLApi(page: Page, bracelet: string) {
  await expect(async () => {
    await page.getByRole('button', { name: 'Récupérer les fiches' }).click();
    await expect(page.getByRole('table').getByText(new RegExp(bracelet))).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 30000 });
}

test('inscription et enregistrement de la clé API', async ({ page }) => {
  await gotoBacASable(page, '/inscription');
  await expect(page.getByText(/BAC À SABLE — environnement de test/)).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill(COMPTE_BAC_A_SABLE);
  await page.getByLabel(/Mot de passe/).fill(MOT_DE_PASSE);
  await page.getByRole('button', { name: 'Créer mon compte' }).click();
  await expect(page.getByRole('heading', { name: "Tester l'API Zacharie" })).toBeVisible({ timeout: 10000 });

  // sans clé, les étapes suivantes sont bloquées
  await expect(page.getByRole('button', { name: "Demander l'accès" })).toBeDisabled();

  await page.getByLabel('Clé privée').fill(CLE_API);
  await page.getByRole('button', { name: 'Enregistrer la clé' }).click();
  await expect(page.getByText('…user')).toBeVisible();
  await expect(page.getByLabel('Clé privée')).toBeHidden();

  await page.getByRole('button', { name: 'Remplacer' }).click();
  await expect(page.getByLabel('Clé privée')).toBeVisible();
  await page.getByRole('button', { name: 'Annuler' }).click();
  await expect(page.getByLabel('Clé privée')).toBeHidden();
  await expect(page.getByRole('button', { name: "Demander l'accès" })).toBeEnabled();
});

test("demande d'accès, accord donné dans Zacharie, puis statut vérifié", async ({ page }) => {
  await seConnecterAuBacASable(page);
  await page.getByLabel(/Email du compte Zacharie/).fill(COMPTE_ZACHARIE);
  await page.getByRole('button', { name: "Demander l'accès" }).click();
  await expect(page.getByText('PENDING', { exact: true })).toBeVisible({ timeout: 10000 });

  // le chasseur donne son accord dans Zacharie
  const zacharie = await page.context().newPage();
  await connectWith(zacharie, COMPTE_ZACHARIE);
  await zacharie.goto('http://localhost:3290/app/chasseur/profil/partage-de-mes-donnees');
  await expect(zacharie.getByText('Test API Key User')).toBeVisible({ timeout: 10000 });
  // liste déroulante (react-select) : on ouvre le champ, pas le texte de la valeur affichée
  await expect(zacharie.getByText('En attente de mon accord')).toBeVisible();
  await zacharie.getByRole('combobox').click();
  const accordEnregistre = zacharie.waitForResponse(
    (res) => res.url().includes('/api-key-approval/') && res.request().method() === 'POST' && res.ok()
  );
  await zacharie.getByText("J'ai donné mon accord", { exact: true }).click();
  await accordEnregistre;
  await zacharie.close();

  await page.getByRole('button', { name: "Vérifier le statut de l'accès" }).click();
  await expect(page.getByText('APPROVED', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Habilité à l'examen initial")).toBeVisible();
});

test('création dans cette page : Zacharie intégré, sans sa navigation, avec les carcasses pré-remplies', async ({
  page,
}) => {
  await seConnecterAuBacASable(page);
  await remplirLaFiche(page, ['BAS-001', 'BAS-002']);
  await page.getByRole('button', { name: 'Créer sur Zacharie, dans cette page' }).click();
  await expect(page.locator('code', { hasText: /nouvelle-fiche.*embedded=true/ })).toBeVisible({
    timeout: 10000,
  });

  await page.locator('iframe[title="Zacharie"]').scrollIntoViewIfNeeded();
  const zacharie = page.frameLocator('iframe[title="Zacharie"]');
  await expect(zacharie.getByRole('heading', { name: /^Fiche du/ })).toBeVisible({ timeout: 20000 });
  await expect(zacharie.locator('input#date_mise_a_mort')).toHaveValue(AUJOURD_HUI);

  // mode intégré : ni liens de compte, ni recherche, ni colonnes du pied de page
  await expect(zacharie.getByText('Déconnexion')).toHaveCount(0);
  await expect(zacharie.getByPlaceholder(/Rechercher/)).toHaveCount(0);
  await expect(zacharie.getByText('Assistance', { exact: true })).toHaveCount(0);

  // les carcasses pré-remplies sont créées et synchronisées : l'API les renvoie
  await attendreLaFicheDansLApi(page, 'BAS-001');
  await expect(page.getByRole('table').getByText(/BAS-002 — Sanglier/)).toBeVisible();
});

test('création dans un nouvel onglet : Zacharie complet, avec les carcasses pré-remplies', async ({
  page,
}) => {
  await seConnecterAuBacASable(page);
  await remplirLaFiche(page, ['BAS-003', 'BAS-004']);
  const nouvelOnglet = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Créer sur Zacharie, dans un nouvel onglet' }).click();
  const zacharie = await nouvelOnglet;

  await zacharie.waitForURL(/\/app\/chasseur\/fei\/ZACH-/, { timeout: 20000 });
  expect(zacharie.url()).not.toContain('embedded');
  await expect(zacharie.getByRole('heading', { name: /^Fiche du/ })).toBeVisible({ timeout: 20000 });
  await expect(zacharie.getByText('Déconnexion').first()).toBeVisible();
  await expect(page.getByText("Zacharie s'est ouvert dans un nouvel onglet.")).toBeVisible();

  // le nouvel onglet laisse le bac à sable en arrière-plan, où le navigateur suspend l'affichage :
  // on attend la fin de la synchronisation de Zacharie, puis on revient sur le bac à sable
  await expect(zacharie.getByText('Synchronisation en cours')).toBeHidden({ timeout: 20000 });
  await zacharie.close();
  await page.bringToFront();

  await attendreLaFicheDansLApi(page, 'BAS-003');
  await expect(page.getByRole('table').getByText(/BAS-004 — Sanglier/)).toBeVisible();
});

test("webhook : les carcasses arrivent dans le bac à sable quand l'examen initial est validé", async ({
  page,
}) => {
  await seConnecterAuBacASable(page);
  await remplirLaFiche(page, ['BAS-005', 'BAS-006']);
  // case DSFR : le libellé recouvre la case, on clique sur le libellé
  await page.getByText(/Récupérer automatiquement les carcasses/).click();
  await expect(page.getByLabel(/Récupérer automatiquement les carcasses/)).toBeChecked();
  await page.getByRole('button', { name: 'Créer sur Zacharie, dans cette page' }).click();
  await expect(page.getByText("En attente d'un webhook de Zacharie…")).toBeVisible({ timeout: 10000 });

  // l'examinateur termine la fiche dans Zacharie intégré
  await page.locator('iframe[title="Zacharie"]').scrollIntoViewIfNeeded();
  const zacharie = page.frameLocator('iframe[title="Zacharie"]');
  await expect(zacharie.getByRole('heading', { name: /^Fiche du/ })).toBeVisible({ timeout: 20000 });
  await zacharie.getByRole('button', { name: 'Pierre Petit' }).click();
  await zacharie.getByRole('button', { name: 'Continuer' }).first().click();
  // carcasses et heures sont déjà pré-remplies : la fiche passe directement à la validation
  await expect(zacharie.getByRole('button', { name: /N° BAS-005/ })).toBeVisible();
  await expect(zacharie.getByRole('button', { name: /N° BAS-006/ })).toBeVisible();
  await zacharie.getByRole('button', { name: dateApprobationDuJour() }).click();
  await zacharie.getByText('Je, Martin Marie, certifie qu').click();
  await zacharie.getByRole('button', { name: 'Transmettre', exact: true }).click();
  await expect(zacharie.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  const webhooks = page.getByRole('heading', { name: 'Webhooks reçus' }).locator('..');
  await expect(webhooks.getByText('FEI_APPROBATION_MISE_SUR_LE_MARCHE').first()).toBeVisible({
    timeout: 30000,
  });
  await expect(webhooks.getByText(/BAS-005 — Chevreuil/).first()).toBeVisible();
  await expect(webhooks.getByText(/BAS-006 — Sanglier/).first()).toBeVisible();
});

test('lecture des fiches : la plus récente en premier', async ({ page }) => {
  await seConnecterAuBacASable(page);
  await page.getByRole('button', { name: 'Récupérer les fiches' }).click();
  const lignes = page.getByRole('table').locator('tbody tr');
  await expect(lignes.first()).toContainText('BAS-005', { timeout: 10000 });
  await expect(page.getByRole('table')).toContainText('BAS-003');
  await expect(page.getByRole('table')).toContainText('BAS-001');
});
