import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 163 — Dans l'admin, la recherche des listes « Utilisateurs » et « Entités » trouve aussi par id.

test.beforeEach(async () => {
  await resetDb('SVI');
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdmin(page: Page, path: string) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto(`http://localhost:3290${path}`);
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(new RegExp(path), { timeout: 10000 });
}

test('la recherche des utilisateurs trouve un utilisateur par son id', async ({ page }) => {
  await openAdmin(page, '/app/admin/users');
  await expect(page.getByText('premier-detenteur@example.fr', { exact: true })).toBeVisible({
    timeout: 10000,
  });

  await page.getByPlaceholder('Nom, email, tél, CFEI, id...').fill('qz6e0');

  await expect(page.getByText('examinateur@example.fr', { exact: true })).toBeVisible();
  await expect(page.getByText('premier-detenteur@example.fr', { exact: true })).toHaveCount(0);
});

test('la recherche des entités trouve une entité par son id', async ({ page }) => {
  await openAdmin(page, '/app/admin/entities');
  await expect(page.getByText('ETG 2').first()).toBeVisible({ timeout: 10000 });

  await page
    .getByPlaceholder('Nom, DDECPP, SIRET, adresse, id...')
    .fill('2a8bc866-a709-47d9-aebe-2768fceb2ecb');

  await expect(page.getByText('ETG 1').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('ETG 2')).toHaveCount(0);
});
