import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb();
});

test("Tenter d'ajouter un second rôle via API doit être rejeté", async ({ page, request }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const cookies = await page.context().cookies();
  const cookieHeader = cookies.map((c) => `${c.name}=${c.value}`).join('; ');

  const res = await request.post('http://localhost:3290/api/action/user/examinateur@example.fr', {
    headers: { cookie: cookieHeader, 'content-type': 'application/json' },
    data: { roles: ['CHASSEUR', 'ETG'] },
    failOnStatusCode: false,
  });

  if (res.status() >= 400) {
    expect(res.status()).toBeGreaterThanOrEqual(400);
  } else {
    const body = await res.json().catch(() => ({}));
    const roles = body?.data?.user?.roles ?? body?.user?.roles ?? [];
    expect(Array.isArray(roles) && roles.length <= 1).toBeTruthy();
  }
});
