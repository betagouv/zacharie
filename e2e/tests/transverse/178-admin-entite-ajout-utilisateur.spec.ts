import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 178 — Sur la page admin d'une entité, l'onglet d'ajout d'utilisateurs a une recherche
// (nom, email, ville), une ligne compacte par candidat, et ne propose pas les comptes supprimés.

const API_URL = 'http://localhost:3291';
const etg1Id = '2a8bc866-a709-47d9-aebe-2768fceb2ecb';
const examinateurId = 'QZ6E0'; // Martin Marie, examinateur@example.fr

test.beforeEach(async () => {
  await resetDb();
});

test("l'admin cherche un utilisateur et l'ajoute ; un compte supprimé n'est pas proposé", async ({
  page,
}) => {
  // /app/admin exige ProConnect en plus du login mot de passe (voir 136)
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto(`http://localhost:3290/app/admin/entity/${etg1Id}`);
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/admin/entity/${etg1Id}`), { timeout: 10000 });

  const softDelete = await page.request.post(`${API_URL}/admin/user/${examinateurId}/soft-delete`);
  expect(softDelete.status()).toBe(200);
  await page.reload();

  await page.getByRole('tab', { name: 'Utilisateurs pouvant envoyer des fiches à cette entité' }).click();
  const candidats = page.getByRole('list', { name: 'Utilisateurs à ajouter' });
  const recherche = page.getByRole('searchbox', { name: 'Rechercher (nom, email, ville)' });
  await expect(recherche).toBeVisible({ timeout: 10000 });
  await expect(candidats.getByRole('link', { name: 'Matthias Michu', exact: true })).toBeVisible();

  // Le compte supprimé n'est pas dans les candidats
  await recherche.fill('examinateur@example.fr');
  await expect(page.getByText('Aucun utilisateur ne correspond à la recherche.')).toBeVisible();

  // La recherche ne garde que le candidat qui correspond
  await recherche.fill('etg-2@example.fr');
  await expect(candidats.getByRole('listitem')).toHaveCount(1);
  await expect(candidats.getByText('etg-2@example.fr', { exact: true })).toBeVisible();

  await candidats.getByRole('button', { name: 'Ajouter' }).click();
  await expect(page.getByText("L'entité a été mise à jour avec succès")).toBeVisible({ timeout: 10000 });
  // Ajouté : il quitte la liste des candidats
  await expect(page.getByText('Aucun utilisateur ne correspond à la recherche.')).toBeVisible({
    timeout: 10000,
  });
});
