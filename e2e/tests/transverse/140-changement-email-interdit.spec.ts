import { test, expect } from '../../utils/test';
import type { Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 140 — Un utilisateur ne peut pas changer son email.
// Aucun écran ne le permet (le champ est en lecture seule) et l'email sert d'identité pour ProConnect
// et pour la traçabilité : on vérifie donc le contrat directement sur `POST /user/:user_id`.

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

test('140 - Changer mon email : refusé, même avec le mot de passe', async ({ page }) => {
  await connectWith(page, EMAIL_ACTUEL);
  await expect(page).toHaveURL(/\/app\/chasseur/);
  const cookie = await jwtCookie(page);
  const me = await getMe(page, cookie);
  expect(me.email).toBe(EMAIL_ACTUEL);

  // 1. email inchangé (les formulaires de coordonnées le renvoient à chaque enregistrement) : accepté
  const inchange = await updateUser(page, cookie, me.id, { email: EMAIL_ACTUEL, prenom: 'Jean' });
  expect(inchange.status).toBe(200);
  expect(inchange.body.data.user.email).toBe(EMAIL_ACTUEL);

  // 2. nouvel email : refusé
  const nouvelEmail = await updateUser(page, cookie, me.id, { email: NOUVEL_EMAIL });
  expect(nouvelEmail.status).toBe(403);
  expect(nouvelEmail.body.error).toBe("L'email ne peut pas être modifié");
  expect((await getMe(page, cookie)).email).toBe(EMAIL_ACTUEL);

  // 3. nouvel email avec le mot de passe actuel : refusé aussi
  const avecMotDePasse = await updateUser(page, cookie, me.id, {
    email: NOUVEL_EMAIL,
    currentPassword: MOT_DE_PASSE,
  });
  expect(avecMotDePasse.status).toBe(403);
  expect((await getMe(page, cookie)).email).toBe(EMAIL_ACTUEL);
});
