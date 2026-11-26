import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 108 — Changement de rôle interdit.
// Un utilisateur n'a qu'un seul rôle. L'interface ne propose pas d'en ajouter un second : on envoie
// directement à l'API une modification de son propre compte avec deux rôles, elle doit la refuser.

const API_URL = 'http://localhost:3291';

test.beforeAll(async () => {
  await resetDb();
});

test("Tenter d'ajouter un second rôle via API doit être rejeté", async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const me = await page.request.get(`${API_URL}/user/me`);
  expect(me.status()).toBe(200);
  const userId = (await me.json()).data.user.id as string;

  const twoRoles = await page.request.post(`${API_URL}/user/${userId}`, {
    data: { roles: ['CHASSEUR', 'ETG'] },
  });
  expect(twoRoles.status()).toBe(400);

  const after = await page.request.get(`${API_URL}/user/me`);
  expect((await after.json()).data.user.roles).toEqual(['CHASSEUR']);
});
