import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 178 — Sur les pages admin d'une entité et d'un utilisateur, les onglets d'ajout ont une recherche
// et une ligne compacte par candidat ; les comptes supprimés ne sont pas proposés.

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

test("sur la page d'un utilisateur, l'admin cherche une entité et l'ajoute", async ({ page }) => {
  // /app/admin exige ProConnect en plus du login mot de passe (voir 136)
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto(`http://localhost:3290/app/admin/user/${examinateurId}`);
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(new RegExp(`/app/admin/user/${examinateurId}`), { timeout: 10000 });

  // Seed par défaut : Martin Marie peut déjà envoyer ses fiches à « Association de chasseurs »
  await page.getByRole('tab', { name: 'Peut envoyer des fiches à (1)' }).click();
  const entites = page.getByRole('list', { name: 'Entités à ajouter' });
  const recherche = page.getByRole('searchbox', { name: 'Rechercher (nom, SIRET, DDECPP, ville)' });
  await expect(recherche).toBeVisible({ timeout: 10000 });
  await expect(entites.getByRole('link', { name: 'Collecteur Pro 1', exact: true })).toBeVisible();

  await recherche.fill('etg 2');
  await expect(entites.getByRole('listitem')).toHaveCount(1);
  await entites.getByRole('button', { name: 'Ajouter' }).click();

  await expect(page.getByRole('tab', { name: 'Peut envoyer des fiches à (2)' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Aucune entité ne correspond à la recherche.')).toBeVisible();
});
