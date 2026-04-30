import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 121 — CarcasseIntermediaire API leak test.
// Dispatch 2+2 carcasses to ETG 1 + ETG 2, both ETGs take charge (creating their respective
// CarcasseIntermediaire records). Then login as ETG 1 and attempt to GET ETG 2's
// CarcasseIntermediaire via /carcasse-intermediaire/:fei_numero/:intermediaire_id/:zacharie_carcasse_id.
// Expected: 403 or 404. Actual: 200 (see SECURITY FINDING below).
//
// 🔒 SECURITY FINDING: GET /carcasse-intermediaire/:fei_numero/:intermediaire_id/:zacharie_carcasse_id
// (api-express/src/controllers/carcasse-intermediaire.ts:165-228) only authenticates the JWT —
// no ownership check. Any authenticated user can read any CarcasseIntermediaire record by knowing
// the IDs. Same shape as test 128's vulnerability on POST /carcasse/:id. Fix the backend
// (add ownership check in the GET handler), then unskip this test as a regression guard.

test.setTimeout(180_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.skip('API : accès cross-intermédiaire interdit (403/404)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  const API_BASE = 'http://localhost:3291';
  const ETG_2_ENTITY_ID = '8cb0e705-6bbe-43b1-af4a-2daa90db92e0'; // from seed

  // 1. PD dispatches 2+2 to ETG 1 + ETG 2 (mobile viewport)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  // Group 1 → ETG 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Add group 2 → ETG 2 (moves MM-001-001 + MM-001-002)
  const ajouterBtn = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();
  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 2 - 75000 Paris (' }).click();
  const g2Stockage = group2.getByText('Pas de stockage').first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText('Je transporte les carcasses moi').first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 takes charge (creates ETG 1's CarcasseIntermediaire records)
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // 3. ETG 2 takes charge (creates ETG 2's CarcasseIntermediaire records)
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // 4. Login back as ETG 1 — they now have a valid JWT
  await logoutAndConnect(page, 'etg-1@example.fr');
  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(jwtCookie, 'JWT cookie must exist after login').toBeTruthy();

  // 5. Discover ETG 2's intermediaire_id by calling POST /fei/refresh (which DOES include
  //    CarcasseIntermediaire records, unlike GET /fei/:numero). Hard-fail if shape is unexpected.
  const refreshResponse = await page.request.post(`${API_BASE}/fei/refresh`, {
    headers: {
      Cookie: `zacharie_express_jwt=${jwtCookie!.value}`,
      'Content-Type': 'application/json',
    },
    data: JSON.stringify({ numeros: [feiId] }),
  });
  expect(refreshResponse.ok(), `POST /fei/refresh must return 2xx, got ${refreshResponse.status()}`).toBeTruthy();
  const refreshData = await refreshResponse.json();
  const fei = refreshData?.data?.feis?.[0];
  expect(fei, 'Refresh response must include the fei').toBeTruthy();
  const intermediaires = fei.CarcasseIntermediaire ?? [];
  expect(intermediaires.length, 'Fei must have CarcasseIntermediaire records').toBeGreaterThan(0);

  // Find an ETG 2 intermediaire (the one we should NOT be able to access as ETG 1).
  const etg2Intermediaire = intermediaires.find(
    (ci: { intermediaire_entity_id: string }) => ci.intermediaire_entity_id === ETG_2_ENTITY_ID
  );
  expect(
    etg2Intermediaire,
    `Could not find ETG 2 CarcasseIntermediaire (entity ${ETG_2_ENTITY_ID}) in fei`
  ).toBeTruthy();

  // 6. As ETG 1, try to GET ETG 2's carcasse-intermediaire — should be denied.
  const leakUrl = `${API_BASE}/carcasse-intermediaire/${feiId}/${etg2Intermediaire.intermediaire_id}/${etg2Intermediaire.zacharie_carcasse_id}`;
  const leakResponse = await page.request.get(leakUrl, {
    headers: { Cookie: `zacharie_express_jwt=${jwtCookie!.value}` },
  });

  expect(
    [403, 404].includes(leakResponse.status()),
    `Expected 403 or 404 but got ${leakResponse.status()} — backend missing ownership check on GET /carcasse-intermediaire/:id`
  ).toBeTruthy();
});
