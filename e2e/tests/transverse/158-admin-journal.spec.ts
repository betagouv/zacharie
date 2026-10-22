import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 158 — Chaque écriture faite depuis /admin est journalisée (AdminAuditLog, écrit par
// api-express/src/middlewares/admin-audit-log.ts) et se relit sur /app/admin/journal.

const API_URL = 'http://localhost:3291';

test.beforeEach(async () => {
  await resetDb();
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminJournal(page: Page) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/journal');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fjournal/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/journal/, { timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Journal admin (0)' })).toBeVisible({ timeout: 10000 });
}

async function getUserId(page: Page, email: string) {
  const response = await page.request.get(`${API_URL}/admin/users`);
  const { data } = await response.json();
  return data.users.find((user: { email: string }) => user.email === email).id as string;
}

test("les écritures de l'admin apparaissent dans le journal, réussies ou refusées", async ({ page }) => {
  await openAdminJournal(page);
  const userId = await getUserId(page, 'examinateur@example.fr');

  const unblock = await page.request.post(`${API_URL}/admin/user/${userId}/unblock`);
  expect(unblock.status()).toBe(200);
  // un utilisateur n'a qu'un seul rôle : l'API refuse d'en poser deux
  const twoRoles = await page.request.post(`${API_URL}/admin/user/${userId}`, {
    data: { roles: ['CHASSEUR', 'ETG'] },
  });
  expect(twoRoles.status()).toBe(406);

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Journal admin (2)' })).toBeVisible({ timeout: 10000 });

  const unblockRow = page.getByRole('row').filter({ hasText: 'Déblocage de la connexion' });
  await expect(unblockRow).toContainText('admin@example.fr');
  await expect(unblockRow).toContainText('examinateur@example.fr');
  await expect(unblockRow).toContainText('OK');

  const refusedRow = page.getByRole('row').filter({ hasText: 'Modification d’utilisateur' });
  await expect(refusedRow).toContainText('Échec (406)');
  await refusedRow.getByRole('button', { name: 'Détails' }).click();
  await expect(page.getByText('Données envoyées')).toBeVisible();
  await expect(page.getByText('"ETG"')).toBeVisible();

  // le lien de la cible mène à la fiche de l'utilisateur
  await unblockRow.getByRole('link', { name: 'examinateur@example.fr' }).click();
  await expect(page).toHaveURL(new RegExp(`/app/admin/user/${userId}`));
});
