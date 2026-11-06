import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 167 — Un admin Zacharie importe des associations de chasse (premiers détenteurs) depuis
// un fichier CSV de fédération : colonnes « Raison sociale », « Code postal », « Commune ».
// Le code interne en début de raison sociale (« 4111101 ANDREST ») est retiré. L'association
// « Association de chasseurs » (75000 Paris) existe déjà dans le seed : elle est ignorée.

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb();
});

const csv = [
  'Raison sociale;Code  postal;Commune',
  '4111101 ANDREST;65800;AUREILHAN',
  '4111102 Aouquerats - La Tyre (CASTELNAU RIVIERE BASSE);65700;CASTELNAU-RIVIERE-BASSE',
  'Association de chasseurs;75000;Paris',
].join('\n');

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminEntities(page: Page) {
  await connectWith(page, 'admin@example.fr');
  // le login renvoie l'admin sur son espace chasseur : on attend cette page avant d'ouvrir /admin,
  // sinon la navigation part pendant la redirection et ProConnect reçoit un `redirect` imbriqué
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/entities');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fentities/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/entities/, { timeout: 10000 });
}

test('importer des premiers détenteurs depuis un CSV de fédération', async ({ page }) => {
  await openAdminEntities(page);

  await page.getByRole('link', { name: 'Importer des premiers détenteurs (CSV/XLS)' }).click();
  await expect(
    page.getByRole('heading', { name: 'Importer des premiers détenteurs depuis un fichier CSV/XLS' })
  ).toBeVisible();

  await page
    .getByLabel('Fichier des premiers détenteurs')
    .setInputFiles({ name: 'fdc65.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });

  await expect(page.getByText('2 nouveau(x)')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('1 déjà enregistré(s) (ignorés)')).toBeVisible();
  await expect(page.getByRole('cell', { name: 'ANDREST', exact: true })).toBeVisible();
  await expect(
    page.getByRole('cell', { name: 'Aouquerats - La Tyre (CASTELNAU RIVIERE BASSE)', exact: true })
  ).toBeVisible();

  await page.getByRole('button', { name: 'Importer (2 premier(s) détenteur(s))' }).click();
  await expect(page.getByText('2 créé(s), 1 déjà enregistré(s).')).toBeVisible({ timeout: 10000 });

  // un second import du même fichier ne crée pas de doublon
  await page.getByRole('button', { name: 'Nouvel import' }).click();
  await page
    .getByLabel('Fichier des premiers détenteurs')
    .setInputFiles({ name: 'fdc65.csv', mimeType: 'text/csv', buffer: Buffer.from(csv, 'utf-8') });
  await expect(page.getByText('0 nouveau(x)')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('3 déjà enregistré(s) (ignorés)')).toBeVisible();

  await page.goto('http://localhost:3290/app/admin/entities');
  await page.getByPlaceholder('Nom, DDECPP, SIRET, adresse, id...').fill('ANDREST');
  await expect(page.getByRole('link', { name: 'ANDREST', exact: true })).toBeVisible({ timeout: 10000 });
});
