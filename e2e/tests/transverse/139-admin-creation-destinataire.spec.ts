import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async ({ page }) => {
  await resetDb();
  await page.route('https://recherche-entreprises.api.gouv.fr/**', (route) =>
    route.fulfill({ json: { results: [] } })
  );
});

async function openAdminAddEntity(page: Parameters<typeof connectWith>[0]) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/add-entity');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fadd-entity/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/add-entity/, { timeout: 10000 });
}

async function cocher(page: Page, label: string) {
  const option = page.getByText(label);
  await option.scrollIntoViewIfNeeded();
  await option.click();
}

async function creerRaisonSociale(page: Page, raisonSociale: string) {
  const input = page.locator("[class*='raison_sociale'] input").first();
  await input.scrollIntoViewIfNeeded();
  await input.fill(raisonSociale);
  await page.getByRole('option', { name: `Ajouter "${raisonSociale}"` }).click();
}

async function choisirRaisonSocialeExistante(page: Page, option: RegExp) {
  await page.locator("[class*='raison_sociale'][class*='input-container']").first().click();
  await page.getByRole('option', { name: option }).click();
}

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

  await cocher(page, 'Commerce de détail (boucherie, restaurant, etc.)');

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

  await expect(page.locator(fieldIds.email)).toBeHidden();
  await creerRaisonSociale(page, 'ETG Zacharie E2E');
  await page.getByRole('button', { name: 'Créer' }).click();

  await expect(page).toHaveURL(/\/app\/admin\/entity\/[^/]+$/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'ETG Zacharie E2E' })).toBeVisible({ timeout: 10000 });
});

test('un destinataire déjà enregistré est signalé au lieu d’être dupliqué', async ({ page }) => {
  await openAdminAddEntity(page);

  await cocher(page, 'Commerce de détail (boucherie, restaurant, etc.)');
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
  await cocher(page, 'Commerce de détail (boucherie, restaurant, etc.)');
  await choisirRaisonSocialeExistante(page, /Boucherie Doublon E2E - 34000 Montpellier/);

  await expect(page.getByText('Cette entité est déjà enregistrée dans Zacharie')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('link', { name: 'Ouvrir sa fiche' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Créer' })).toBeDisabled();
});
