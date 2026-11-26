import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

const API_URL = 'http://localhost:3291';
const feiId = 'ZACH-20250707-QZ6E0-185242';
const carcasseId = `${feiId}_MM-001-001`;

test.beforeEach(async () => {
  await resetDb('SVI');
});

async function openAdmin(page: Page, path: string) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto(`http://localhost:3290${path}`);
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(new RegExp(path), { timeout: 10000 });
}

test("l'historique d'une fiche montre les modifications de ses carcasses, avec leur auteur", async ({
  page,
}) => {
  await openAdmin(page, `/app/admin/fei/${feiId}`);

  const softDelete = await page.request.post(`${API_URL}/admin/carcasse/${carcasseId}/soft-delete`);
  expect(softDelete.status()).toBe(200);

  await page.reload();
  const historiqueTab = page.getByRole('tab', { name: 'Historique' });
  await historiqueTab.scrollIntoViewIfNeeded();
  await historiqueTab.click();

  const modification = page
    .getByRole('listitem')
    .filter({ hasText: 'Carcasse MM-001-001' })
    .filter({ hasText: 'Supprimé le' });
  await expect(modification).toBeVisible({ timeout: 10000 });
  await expect(modification).toContainText('Modification');
  await expect(modification.getByTitle('admin@example.fr')).toHaveText('par admin');

  const adminAction = page.getByRole('listitem').filter({ hasText: 'Suppression de carcasse' });
  await expect(adminAction).toContainText('Action admin');

  await page.goto('http://localhost:3290/app/admin/historique');
  await page.getByLabel("Email de l'auteur").fill('admin@example.fr');
  await expect(
    page
      .getByRole('listitem')
      .filter({ hasText: 'Carcasse MM-001-001' })
      .filter({ hasText: 'Supprimé le' })
      .getByTitle('admin@example.fr')
  ).toHaveText('par admin', { timeout: 10000 });
});

test("l'historique d'un utilisateur montre le champ modifié par l'admin", async ({ page }) => {
  await openAdmin(page, '/app/admin/users');
  const users = await (await page.request.get(`${API_URL}/admin/users`)).json();
  const userId = users.data.users.find((user: { email: string }) => user.email === 'svi@example.fr').id;

  const update = await page.request.post(`${API_URL}/admin/user/${userId}`, {
    data: { prenom: 'Prénom modifié' },
  });
  expect(update.status()).toBe(200);

  await page.goto(`http://localhost:3290/app/admin/user/${userId}`);
  const historiqueTab = page.getByRole('tab', { name: 'Historique' });
  await historiqueTab.scrollIntoViewIfNeeded();
  await historiqueTab.click();

  const modification = page
    .getByRole('listitem')
    .filter({ hasText: 'par auteur inconnu' })
    .filter({ hasText: 'Prénom' });
  await expect(modification).toContainText('Prénom modifié', { timeout: 10000 });
  const adminAction = page.getByRole('listitem').filter({ hasText: 'Modification d’utilisateur' });
  await expect(adminAction.getByTitle('admin@example.fr')).toHaveText('par admin');
  await expect(adminAction).toContainText('Prénom modifié');
});
