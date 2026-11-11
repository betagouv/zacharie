import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 171 — Un admin Zacharie saisit les références nationales lues par Metabase pour les KPI
// (table stats_ref_national) sur /app/admin/stats-ref : ajout, doublon refusé, modification,
// suppression. Chaque écriture apparaît dans le journal admin.

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb();
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminStatsRef(page: Page) {
  await connectWith(page, 'admin@example.fr');
  // le login renvoie l'admin sur son espace chasseur : on attend cette page avant d'ouvrir /admin,
  // sinon la navigation part pendant la redirection et ProConnect reçoit un `redirect` imbriqué
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/stats-ref');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fstats-ref/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/stats-ref/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Ajouter une référence' })).toBeVisible({
    timeout: 10000,
  });
}

async function addVolumeGlobal2022(page: Page) {
  await page.getByLabel('Saison').fill('2022-2023');
  await page.getByLabel('Circuit').selectOption({ label: 'Circuit long' });
  await page.getByLabel('Type de gibier').selectOption({ label: 'Grand gibier' });
  await page.getByLabel('Indicateur').selectOption({ label: 'Volume global (carcasses)' });
  await page.getByLabel('Valeur').fill('60000');
  const addButton = page.getByRole('button', { name: 'Ajouter', exact: true });
  await addButton.scrollIntoViewIfNeeded();
  await addButton.click();
}

test('ajouter, modifier et supprimer une référence stats', async ({ page }) => {
  await openAdminStatsRef(page);

  const row = page.getByRole('row').filter({ hasText: '2022-2023' });

  await addVolumeGlobal2022(page);
  await expect(row).toHaveCount(1, { timeout: 10000 });
  await expect(row).toContainText('Circuit long');
  await expect(row).toContainText('Grand gibier');
  await expect(row).toContainText('Volume global (carcasses)');
  await expect(row.getByRole('cell', { name: '60000', exact: true })).toBeVisible();

  // la même saison × circuit × gibier × indicateur est refusée
  await addVolumeGlobal2022(page);
  await expect(page.getByText(/existe déjà/)).toBeVisible({ timeout: 10000 });
  await expect(row).toHaveCount(1);

  const editButton = row.getByRole('button', { name: 'Modifier' });
  await editButton.scrollIntoViewIfNeeded();
  await editButton.click();
  await expect(page.getByRole('heading', { name: 'Modifier la référence' })).toBeVisible();
  await page.getByLabel('Valeur').fill('65000');
  const saveButton = page.getByRole('button', { name: 'Enregistrer' });
  await saveButton.scrollIntoViewIfNeeded();
  await saveButton.click();
  await expect(row.getByRole('cell', { name: '65000', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Ajouter une référence' })).toBeVisible();

  page.once('dialog', (dialog) => dialog.accept());
  const deleteButton = row.getByRole('button', { name: 'Supprimer' });
  await deleteButton.scrollIntoViewIfNeeded();
  await deleteButton.click();
  await expect(row).toHaveCount(0, { timeout: 10000 });

  const journalLink = page.getByRole('link', { name: 'Journal admin' });
  await journalLink.scrollIntoViewIfNeeded();
  await journalLink.click();
  await expect(page).toHaveURL(/\/app\/admin\/journal/);
  await expect(page.getByRole('row').filter({ hasText: 'Ajout de référence stats' }).first()).toBeVisible({
    timeout: 10000,
  });
});
