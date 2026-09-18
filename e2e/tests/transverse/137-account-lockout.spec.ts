import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  launchOptions: {
    slowMo: 100,
  },
});

test.beforeAll(async () => {
  await resetDb();
});

test('Le compte est verrouillé après 5 tentatives échouées avec un mauvais mot de passe', async ({
  page,
}) => {
  const email = 'examinateur@example.fr';
  const wrongPassword = 'mauvais-mot-de-passe-12345';

  for (let i = 0; i < 4; i++) {
    await connectWith(page, email, wrongPassword, false);
    await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible({ timeout: 5000 });
  }

  // 5th attempt triggers lockout
  await connectWith(page, email, wrongPassword, false);
  await expect(page.getByText('Trop de tentatives')).toBeVisible({ timeout: 5000 });
});

test('Le compte reste verrouillé même avec le bon mot de passe', async ({ page }) => {
  const email = 'examinateur@example.fr';

  await connectWith(page, email, 'secret-secret', false);
  await expect(page.getByText('Trop de tentatives')).toBeVisible({ timeout: 5000 });
});

test('Un autre compte reste accessible pendant le verrouillage', async ({ page }) => {
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
});

test('Un email inexistant est aussi verrouillé après 5 tentatives', async ({ page }) => {
  const fakeEmail = 'nexistepas@example.fr';
  const wrongPassword = 'nimportequoi-12345';

  for (let i = 0; i < 4; i++) {
    await connectWith(page, fakeEmail, wrongPassword, false);
    await expect(page.getByText('Email ou mot de passe incorrect')).toBeVisible({ timeout: 5000 });
  }

  // 5th attempt triggers lockout even for non-existing email
  await connectWith(page, fakeEmail, wrongPassword, false);
  await expect(page.getByText('Trop de tentatives')).toBeVisible({ timeout: 5000 });
});

test("L'email inexistant reste verrouillé aux tentatives suivantes", async ({ page }) => {
  const fakeEmail = 'nexistepas@example.fr';

  await connectWith(page, fakeEmail, 'autrechose-12345', false);
  await expect(page.getByText('Trop de tentatives')).toBeVisible({ timeout: 5000 });
});
