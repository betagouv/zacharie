import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb();
});

test("un compte bloqué apparaît à l'admin, avec la dernière tentative, et se débloque", async ({ page }) => {
  for (let i = 1; i < 5; i++) {
    await connectWith(page, 'examinateur@example.fr', 'mauvais-mot-de-passe', false);
    await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible();
  }
  await connectWith(page, 'examinateur@example.fr', 'mauvais-mot-de-passe', false);
  await expect(page.getByText('Trop de tentatives. Réessayez dans 15 minutes.')).toBeVisible();
  await connectWith(page, 'examinateur@example.fr', 'secret-secret', false);
  await expect(page.getByText('Trop de tentatives. Réessayez dans 15 minutes.')).toBeVisible();

  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.goto('http://localhost:3290/app/admin/a-traiter');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fa-traiter/);
  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();
  await expect(page).toHaveURL(/\/app\/admin\/a-traiter/, { timeout: 10000 });

  await page.getByRole('link', { name: 'Martin Marie' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion bloquée' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Le blocage expire le')).toBeVisible();
  await expect(page.getByText('Dernière tentative le')).toBeVisible();

  await page.getByRole('button', { name: 'Débloquer' }).click();
  await expect(page.getByText('Utilisateur débloqué')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { name: 'Connexion bloquée' })).toBeHidden();

  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
});
