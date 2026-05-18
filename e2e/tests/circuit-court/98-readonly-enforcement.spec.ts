import { test, expect } from '@playwright/test';
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

// ⚠️ SECURITY GUARD: sync-carcasse.ts does not currently role-gate non-SVI
// fields. A COMMERCE_DE_DETAIL user can in principle POST a payload to /sync
// that modifies carcasse.commentaire or anomalies and have it persisted.
// This test asserts the desired (post-refactor) behavior: the sync route
// must reject the write (4xx) OR silently drop it (no DB mutation).
// SKIP today; un-skip once the backend gains a role guard.
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

  // Acceptable outcomes:
  //  (a) backend explicitly rejects (4xx)
  //  (b) backend accepts (200) but does NOT persist the write
  // Either way: the probe string must not show up on a subsequent GET.
  expect(syncRes.status()).toBeLessThan(500);

  // Re-fetch the carcasse and assert the write did not stick.
  await page.reload();
  await expect(page.getByText(probeCommentaire)).toHaveCount(0);
});
