import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 98 — Commerce de détail = lecture seule.
//
// Sister to 95 (no transmission UI affordance) and 97 (no re-transmission UI):
// here we go one layer deeper and assert there is no write affordance AT ALL
// on a carcasse in the CC view, then probe the API directly to verify the
// backend rejects writes from a CC user.
//
// Why this matters for the fetch refactor: today, CC's read-only behavior is
// enforced via UI absence + role-scoped reads. After flipping to carcasse-first
// fetches, the role-based write rejection at endpoint level becomes the only
// guard. If the API silently accepts a CC user's POST/PUT to a carcasse, the
// refactor will expose that gap immediately.

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

  // No transmission, no next-owner selector (already covered by 95/97 but
  // pinned here too so this spec stands alone).
  await expect(page.getByRole('button', { name: /Transmettre la fiche/i })).toHaveCount(0);
  await expect(page.locator("[class*='select-prochain-detenteur']")).toHaveCount(0);

  // Strict: no save/edit buttons in the carcasse panels either.
  // CC must be a pure consumer of the data — any "Enregistrer" / "Modifier"
  // affordance is a regression.
  await expect(page.getByRole('button', { name: /^Enregistrer$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Modifier$/i })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^Refuser/i })).toHaveCount(0);
});

// Le commerce de détail est le destinataire des carcasses de la fiche : sans garde par rôle, il
// passerait les droits du détenteur en cours (transmission, refus, statut). Le backend refuse toute
// écriture de carcasse venant d'un commerce de détail, et la carcasse reste intacte en base.
test('API : POST /sync depuis un CC est refusé et ne modifie pas la carcasse', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-195242';
  const API_BASE = 'http://localhost:3291';

  await connectWith(page, 'commerce-de-detail@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/circuit-court/fei/${feiId}`));

  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(jwtCookie).toBeTruthy();
  const headers = { Cookie: `zacharie_express_jwt=${jwtCookie!.value}` };

  const zacharie_carcasse_id = `${feiId}_MM-001-001`;
  const probeCommentaire = `cc-cannot-write-${Date.now()}`;

  const syncRes = await page.request.post(`${API_BASE}/sync`, {
    headers: { ...headers, 'Content-Type': 'application/json' },
    data: JSON.stringify({
      feis: [],
      carcasses: [
        {
          fei_numero: feiId,
          zacharie_carcasse_id,
          // version au-dessus de celle de la base : le refus ne vient pas d'une écriture périmée
          version: 1_000_000,
          examinateur_commentaire: probeCommentaire,
          examinateur_anomalies_carcasse: ['anomalie inventée par le commerce'],
          intermediaire_carcasse_refus_motif: probeCommentaire,
          next_owner_entity_id: null,
          next_owner_role: null,
        },
      ],
      carcassesIntermediaires: [],
      logs: [],
    }),
  });

  expect(syncRes.status()).toBe(200);
  const syncBody = await syncRes.json();
  expect(syncBody.data.carcasses).toHaveLength(0);
  expect(syncBody.data.rejected).toEqual([
    { kind: 'carcasse', id: zacharie_carcasse_id, reason: 'Vous ne pouvez pas modifier cette carcasse' },
  ]);

  // La carcasse en base n'a pas bougé : toujours destinée au commerce de détail, sans commentaire,
  // anomalie ni refus du probe.
  const getRes = await page.request.get(`${API_BASE}/carcasse`, { headers });
  expect(getRes.status()).toBe(200);
  const getBody = await getRes.json();
  const carcasse = getBody.data.carcasses.find(
    (c: { zacharie_carcasse_id: string }) => c.zacharie_carcasse_id === zacharie_carcasse_id
  );
  expect(carcasse).toBeTruthy();
  expect(carcasse.next_owner_role).toBe('COMMERCE_DE_DETAIL');
  expect(carcasse.next_owner_entity_id).toBeTruthy();
  expect(carcasse.examinateur_commentaire).not.toBe(probeCommentaire);
  expect(carcasse.examinateur_anomalies_carcasse).not.toContain('anomalie inventée par le commerce');
  expect(carcasse.intermediaire_carcasse_refus_motif).not.toBe(probeCommentaire);

  await page.reload();
  await expect(page.getByText(probeCommentaire)).toHaveCount(0);
});
