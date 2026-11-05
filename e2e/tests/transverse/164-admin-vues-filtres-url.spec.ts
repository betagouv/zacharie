import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 164 — Les filtres des listes admin vivent dans l'URL : une vue prédéfinie filtre la liste,
// le rechargement et le bouton retour retrouvent la même liste.

test.beforeEach(async () => {
  await resetDb();
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminUsers(page: Page) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/users');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fusers/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/users/, { timeout: 10000 });
}

test('une vue filtre la liste des utilisateurs et survit au rechargement et au retour', async ({ page }) => {
  await openAdminUsers(page);
  const views = page.getByRole('group', { name: 'Vues' });
  const actif = page.getByRole('link', { name: 'Martin Marie', exact: true });
  const inactif = page.getByRole('link', { name: 'Moreau Lucie', exact: true });

  await expect(actif).toBeVisible({ timeout: 10000 });
  await expect(views.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true');

  await views.getByRole('button', { name: 'Désactivés' }).click();
  await expect(page).toHaveURL(/statut=deactivated/);
  await expect(views.getByRole('button', { name: 'Désactivés' })).toHaveAttribute('aria-pressed', 'true');
  await expect(inactif).toBeVisible();
  await expect(actif).toBeHidden();

  await page.reload();
  await expect(inactif).toBeVisible({ timeout: 10000 });
  await expect(actif).toBeHidden();
  await expect(views.getByRole('button', { name: 'Désactivés' })).toHaveAttribute('aria-pressed', 'true');

  await page.goBack();
  await expect(page).not.toHaveURL(/statut=/);
  await expect(actif).toBeVisible({ timeout: 10000 });
  await expect(views.getByRole('button', { name: 'Tous' })).toHaveAttribute('aria-pressed', 'true');
});

test('la recherche des utilisateurs est reprise depuis un lien partagé', async ({ page }) => {
  await openAdminUsers(page);
  await page.goto('http://localhost:3290/app/admin/users?q=moreau');
  await expect(page.getByRole('link', { name: 'Moreau Lucie', exact: true })).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('link', { name: 'Martin Marie', exact: true })).toBeHidden();
  await expect(page.getByPlaceholder('Nom, email, tél, CFEI, id...')).toHaveValue('moreau');
});
