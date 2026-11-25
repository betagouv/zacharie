import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

const API_URL = 'http://localhost:3291';
const ETG_1_ID = '2a8bc866-a709-47d9-aebe-2768fceb2ecb';

const ETG_1_MEMBER_EMAIL = 'etg-1@example.fr';
const ETG_1_MEMBER_LASTNAME = 'Robert';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

test("un chasseur ne peut pas lire la PII des membres d'une ETG via une relation REQUESTED auto-créée", async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\//);

  const meId = await page.evaluate(async (api) => {
    const res = await fetch(`${api}/user/me`, { credentials: 'include' }).then((r) => r.json());
    return res?.data?.user?.id as string | undefined;
  }, API_URL);
  expect(meId).toBeTruthy();

  const attach = await page.evaluate(
    async ({ api, ownerId, entityId }) => {
      const res = await fetch(`${api}/user-entity`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_id: ownerId,
          entity_id: entityId,
          relation: 'CAN_HANDLE_CARCASSES_ON_BEHALF_ENTITY',
        }),
      });
      return { status: res.status, body: await res.json() };
    },
    { api: API_URL, ownerId: meId, entityId: ETG_1_ID }
  );
  expect(attach.status).toBe(200);

  const workingFor = await page.evaluate(async (api) => {
    return fetch(`${api}/entite/working-for`, { credentials: 'include' }).then((r) => r.json());
  }, API_URL);

  const serialized = JSON.stringify(workingFor);

  expect(serialized).not.toContain(ETG_1_MEMBER_EMAIL);
  expect(serialized).not.toContain(ETG_1_MEMBER_LASTNAME);

  const etg1 = workingFor?.data?.userEntitiesByTypeAndId?.ETG?.[ETG_1_ID];
  if (etg1) {
    for (const rel of etg1.EntityRelationsWithUsers ?? []) {
      expect(rel.UserRelatedWithEntity ?? null).toBeNull();
    }
  }
});
