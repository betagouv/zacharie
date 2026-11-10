import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 169 — La page « À traiter » de l'admin compte ce qui attend une action, chaque carte mène
// à la liste filtrée ; /app/admin et l'ancien /app/admin/dashboard y mènent aussi.

test.beforeEach(async () => {
  await resetDb();
});

// Le login mot de passe ouvre une session normale ; /app/admin exige en plus ProConnect (voir 136)
async function openAdminATraiter(page: Page) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/a-traiter');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fa-traiter/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/a-traiter/, { timeout: 10000 });
}

test('les cartes comptent ce qui est à traiter et mènent à la liste filtrée', async ({ page }) => {
  await openAdminATraiter(page);
  const main = page.getByRole('main');

  await expect(main.getByRole('heading', { name: 'À traiter' })).toBeVisible({ timeout: 10000 });
  for (const titre of [
    "En attente d'activation",
    'CFEI introuvable',
    'Onboarding incomplet > 7 j',
    'Comptes bloqués',
    'Entités non prêtes',
  ]) {
    await expect(main.getByText(titre, { exact: true })).toBeVisible();
  }

  // Seed par défaut : tous les comptes viennent d'être créés, aucun n'a plus de 7 jours
  const onboardingIncomplet = main.getByText('Onboarding incomplet > 7 j', { exact: true }).locator('..');
  await expect(onboardingIncomplet.getByText('0', { exact: true })).toBeVisible();
  await expect(main.getByRole('link', { name: /Onboarding incomplet/ })).toHaveCount(0);

  // Seed par défaut : Moreau Lucie et Girard Hugo ont fini l'onboarding sans être activés
  const enAttente = main.getByRole('link', { name: /En attente d'activation/ });
  await expect(enAttente.getByText('2', { exact: true })).toBeVisible();
  await enAttente.click();
  await expect(page).toHaveURL(/statut=deactivated/);
  await expect(page).toHaveURL(/onboarding=completed/);
  await expect(page.getByRole('link', { name: 'Moreau Lucie', exact: true })).toBeVisible({ timeout: 10000 });
});

test("/app/admin et l'ancien tableau de bord mènent à « À traiter », les statistiques restent accessibles", async ({
  page,
}) => {
  await openAdminATraiter(page);

  await page.goto('http://localhost:3290/app/admin');
  await expect(page).toHaveURL(/\/app\/admin\/a-traiter/, { timeout: 10000 });

  await page.goto('http://localhost:3290/app/admin/dashboard');
  await expect(page).toHaveURL(/\/app\/admin\/a-traiter/, { timeout: 10000 });

  await page.getByRole('link', { name: 'Statistiques', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/admin\/statistiques/);
  await expect(page.getByRole('heading', { name: 'Statistiques' })).toBeVisible({ timeout: 10000 });
});
