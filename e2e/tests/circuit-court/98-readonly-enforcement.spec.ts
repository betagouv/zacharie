import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('COMMERCE_DE_DETAIL');
});

test("UI : aucune affordance d'édition sur une carcasse côté CC", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  await expect(page.getByRole('button', { name: /Transmettre la fiche/i })).toHaveCount(0);
  await expect(page.locator("[class*='select-prochain-detenteur']")).toHaveCount(0);

  await expect(page.getByRole('button', { name: /^Enregistrer$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Modifier$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Refuser/i })).toHaveCount(0);
});

test.skip('API : POST /sync depuis un CC ne doit pas modifier la carcasse', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  const API_BASE = 'http://localhost:3291';

  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(jwtCookie).toBeTruthy();

  const zacharie_carcasse_id = `${feiId}_MM-001-001`;
  const probeCommentaire = `cc-cannot-write-${Date.now()}`;

  const syncRes = await page.request.post(`${API_BASE}/sync`, {
    headers: {
      Cookie: `zacharie_express_jwt=${jwtCookie!.value}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({
      feis: [],
      carcasses: [
        {
          fei_numero: feiId,
          zacharie_carcasse_id,
          examinateur_commentaire: probeCommentaire,
        },
      ],
      carcassesIntermediaires: [],
      logs: [],
    }),
  });

  expect(syncRes.status()).toBeLessThan(500);

  await page.reload();
  await expect(page.getByText(probeCommentaire)).toHaveCount(0);
});
