import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 140 — Changer d'email exige le mot de passe actuel.
// L'email sert d'identité pour ProConnect (accès admin) : une session seule ne doit pas suffire à le
// changer. Aucun écran ne permet à l'utilisateur de modifier son email (le champ est en lecture
// seule), on vérifie donc le contrat directement sur `POST /user/:user_id`.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

const API_BASE = 'http://localhost:3291';
const EMAIL_ACTUEL = 'examinateur@example.fr';
const NOUVEL_EMAIL = 'nouvel-email-examinateur@example.fr';
const MOT_DE_PASSE = 'secret-secret';

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

async function jwtCookie(page: Page) {
  const cookies = await page.context().cookies();
  const cookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(cookie, "pas de cookie JWT : la connexion n'a pas abouti").toBeTruthy();
  return `zacharie_express_jwt=${cookie!.value}`;
}

async function getMe(page: Page, cookie: string) {
  const res = await page.request.get(`${API_BASE}/user/me`, { headers: { Cookie: cookie } });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data.user as { id: string; email: string };
}

async function updateUser(page: Page, cookie: string, userId: string, data: object) {
  const res = await page.request.post(`${API_BASE}/user/${userId}`, {
    headers: { Cookie: cookie, 'Content-Type': 'application/json' },
    data: JSON.stringify(data),
  });
  return { status: res.status(), body: await res.json() };
}

test('140 - Changer mon email : refusé sans le bon mot de passe, accepté avec', async ({ page }) => {
  await connectWith(page, EMAIL_ACTUEL);
  await expect(page).toHaveURL(/\/app\/chasseur/);
  const cookie = await jwtCookie(page);
  const me = await getMe(page, cookie);
  expect(me.email).toBe(EMAIL_ACTUEL);

  // 1. email inchangé (les formulaires de coordonnées le renvoient à chaque enregistrement) : pas de
  // mot de passe demandé
  const inchange = await updateUser(page, cookie, me.id, { email: EMAIL_ACTUEL, prenom: 'Jean' });
  expect(inchange.status).toBe(200);
  expect(inchange.body.data.user.email).toBe(EMAIL_ACTUEL);

  // 2. nouvel email sans mot de passe : refusé
  const sansMotDePasse = await updateUser(page, cookie, me.id, { email: NOUVEL_EMAIL });
  expect(sansMotDePasse.status).toBe(403);
  expect(sansMotDePasse.body.error).toBe(
    'Veuillez renseigner votre mot de passe actuel pour changer votre email'
  );
  expect((await getMe(page, cookie)).email).toBe(EMAIL_ACTUEL);

  // 3. nouvel email avec un mauvais mot de passe : refusé
  const mauvaisMotDePasse = await updateUser(page, cookie, me.id, {
    email: NOUVEL_EMAIL,
    currentPassword: 'mauvais-mot-de-passe',
  });
  expect(mauvaisMotDePasse.status).toBe(403);
  expect(mauvaisMotDePasse.body.error).toBe('Mot de passe actuel incorrect');
  expect((await getMe(page, cookie)).email).toBe(EMAIL_ACTUEL);

  // 4. email déjà utilisé par un autre compte : refusé proprement
  const emailPris = await updateUser(page, cookie, me.id, {
    email: 'premier-detenteur@example.fr',
    currentPassword: MOT_DE_PASSE,
  });
  expect(emailPris.status).toBe(409);
  expect(emailPris.body.error).toBe('Un compte existe déjà avec cet email');
  expect((await getMe(page, cookie)).email).toBe(EMAIL_ACTUEL);

  // 5. nouvel email avec le bon mot de passe : accepté
  const ok = await updateUser(page, cookie, me.id, {
    email: NOUVEL_EMAIL,
    currentPassword: MOT_DE_PASSE,
  });
  expect(ok.status).toBe(200);
  expect(ok.body.data.user.email).toBe(NOUVEL_EMAIL);
  expect((await getMe(page, cookie)).email).toBe(NOUVEL_EMAIL);

  // 6. on se reconnecte avec le nouvel email
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });

  await connectWith(page, NOUVEL_EMAIL, MOT_DE_PASSE);
  await expect(page).toHaveURL(/\/app\/chasseur/);
});
