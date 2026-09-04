import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 136 — Double authentification ProConnect pour les admins Zacharie.
// Le login mot de passe ouvre une session normale et mène à l'espace habituel (/app/chasseur) ;
// seules les routes /admin exigent en plus un passage ProConnect récent
// (api-express/src/middlewares/passport.ts, stratégie 'admin').
// En test l'API embarque un ProConnect factice (api-express/src/mock-proconnect.ts) dont la page
// /authorize laisse choisir l'email renvoyé.

test.beforeEach(async () => {
  await resetDb();
});

// Le login ne passe pas par ProConnect : l'admin arrive sur son espace chasseur comme tout le monde
async function loginAsAdmin(page: Parameters<typeof connectWith>[0]) {
  await connectWith(page, 'admin@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
}

// Ouvrir /app/admin sans ProConnect récent renvoie sur /app/proconnect avec le chemin demandé en `redirect`
async function openAdminAndExpectProConnect(page: Parameters<typeof connectWith>[0]) {
  await page.goto('http://localhost:3290/app/admin/users');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=%2Fapp%2Fadmin%2Fusers/);
  await expect(page.getByRole('heading', { name: 'Connexion ProConnect requise' })).toBeVisible();
}

test("l'admin est redirigé vers ProConnect en ouvrant /app/admin et y accède une fois identifié", async ({
  page,
}) => {
  await loginAsAdmin(page);
  await openAdminAndExpectProConnect(page);

  await page.locator('a[href*="/user/proconnect/start"]').click();
  await expect(page.getByRole('heading', { name: 'ProConnect (simulateur)' })).toBeVisible();
  await expect(page.getByLabel('Email professionnel')).toHaveValue('admin@example.fr');
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();

  // ProConnect renvoie sur le chemin admin demandé au départ
  await expect(page).toHaveURL(/\/app\/admin\/users/, { timeout: 10000 });
  await expect(page.getByText('admin@example.fr').first()).toBeVisible({ timeout: 10000 });
});

test("l'admin sans ProConnect est bloqué sur /admin et l'API répond PROCONNECT_REQUIRED", async ({
  page,
}) => {
  await loginAsAdmin(page);

  const sessionResponse = page.waitForResponse(
    (res) => res.url().includes('/admin/session') && res.request().method() === 'GET'
  );
  await openAdminAndExpectProConnect(page);
  const response = await sessionResponse;
  expect(response.status()).toBe(403);
  expect((await response.json()).error).toBe('PROCONNECT_REQUIRED');

  // la session normale reste valide : l'admin n'est pas déconnecté
  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page).toHaveURL(/\/app\/chasseur/);
});

test('un email ProConnect différent de celui du compte est refusé', async ({ page }) => {
  await loginAsAdmin(page);
  await openAdminAndExpectProConnect(page);

  await page.locator('a[href*="/user/proconnect/start"]').click();
  await page.getByLabel('Email professionnel').fill('quelqun-d-autre@beta.gouv.fr');
  await page.getByRole('button', { name: "S'identifier avec ProConnect" }).click();

  await expect(page).toHaveURL(/\/app\/proconnect\?error=email_mismatch/, { timeout: 10000 });
  await expect(page.getByText("L'email renvoyé par ProConnect ne correspond pas")).toBeVisible();

  await page.goto('http://localhost:3290/app/admin/users');
  await expect(page).toHaveURL(/\/app\/proconnect\?redirect=/);
});

test('un utilisateur non admin ne passe pas par ProConnect et ne peut pas lancer /user/proconnect/start', async ({
  page,
}) => {
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);

  const response = await page.request.get('http://localhost:3291/user/proconnect/start');
  expect(response.status()).toBe(403);

  await page.goto('http://localhost:3290/app/proconnect');
  await expect(page).toHaveURL(/\/app\/svi/);
});
