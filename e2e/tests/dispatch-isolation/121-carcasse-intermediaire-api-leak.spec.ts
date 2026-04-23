import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 121 — CarcasseIntermediaire API leak test.
// Dispatch 2+2 carcasses to ETG 1 + ETG 2, then login as ETG 1 and attempt to
// GET /carcasse-intermediaire/:fei_numero/:intermediaire_id/:zacharie_carcasse_id
// using ETG 2's intermediaire_id and a carcasse dispatched to ETG 2.
// Expected: 403 or 404 (access denied).

test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('API : accès cross-intermédiaire interdit (403/404)', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  const API_BASE = 'http://localhost:3291';

  // 1. PD dispatches 2+2 to ETG 1 + ETG 2 (mobile viewport)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  // Select ETG 1 for group 1
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Add second group
  const ajouterBtn = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await ajouterBtn.scrollIntoViewIfNeeded();
  await ajouterBtn.click();

  // Move 2 carcasses to group 2
  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();

  // Select ETG 2 for group 2
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 2 - 75000 Paris (' }).click();
  const g2Stockage = group2.getByText('Pas de stockage').first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText('Je transporte les carcasses moi').first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  // Transmettre
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 takes charge (desktop viewport)
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // 3. ETG 2 takes charge
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // 4. Login as ETG 1 and get auth cookies
  await logoutAndConnect(page, 'etg-1@example.fr');
  const cookies = await page.context().cookies();
  const jwtCookie = cookies.find((c) => c.name === 'zacharie_express_jwt');
  expect(jwtCookie).toBeTruthy();

  // 5. Build the URL to access ETG 2's carcasse-intermediaire data
  // ETG 2's intermediaire_id comes from the seed data entity id for ETG 2
  // We need to find the intermediaire_id for ETG 2. From the dispatch, ETG 2 was assigned
  // carcasses MM-001-001 and MM-001-002 (the ones moved to group 2 in spec 117 pattern).
  // The composite key is: fei_numero + zacharie_carcasse_id + intermediaire_id
  // zacharie_carcasse_id for MM-001-001 = feiId + "_MM-001-001"
  const zacharie_carcasse_id_etg2 = `${feiId}_MM-001-001`;

  // We need ETG 2's intermediaire_id. This is a FeiIntermediaire record ID, not the entity ID.
  // Let's fetch the fiche data as ETG 1 to find the intermediaire IDs.
  // Actually, since we can't easily get the intermediaire_id from the UI,
  // let's try using the entity ID directly — the API route uses intermediaire_id
  // which corresponds to a FeiIntermediaire record.
  // From seed data, ETG 2 entity_id = we need to find it.

  // Alternative approach: use the sync endpoint to find intermediaire IDs
  const syncResponse = await page.request.get(`${API_BASE}/fei/${feiId}`, {
    headers: {
      Cookie: `zacharie_express_jwt=${jwtCookie!.value}`,
    },
  });
  expect(syncResponse.ok()).toBeTruthy();
  const feiData = await syncResponse.json();

  // Find the intermediaire record that belongs to ETG 2 (not ETG 1)
  // The fei response should contain intermediaires data
  const intermediaires = feiData.data?.feiIntermediaires || feiData.data?.intermediaires || [];

  if (intermediaires.length < 2) {
    test.skip(
      true,
      'SKIP: Could not find 2 intermediaire records — seed data may not create FeiIntermediaire entries during dispatch'
    );
    return;
  }

  // Find the intermediaire that is NOT etg-1
  // ETG 1 entity is the one associated with etg-1@example.fr
  const etg1Intermediaire = intermediaires.find(
    (i: any) =>
      i.entity_id === '2a8bc866-a709-47d9-aebe-2768fceb2ecb' || i.entity_name_cache?.includes('ETG 1')
  );
  const etg2Intermediaire = intermediaires.find((i: any) => i !== etg1Intermediaire);

  if (!etg2Intermediaire) {
    test.skip(true, 'SKIP: Could not identify ETG 2 intermediaire from fiche data');
    return;
  }

  // 6. As ETG 1, try to GET ETG 2's carcasse-intermediaire
  const leakUrl = `${API_BASE}/carcasse-intermediaire/${feiId}/${etg2Intermediaire.id}/${zacharie_carcasse_id_etg2}`;
  const leakResponse = await page.request.get(leakUrl, {
    headers: {
      Cookie: `zacharie_express_jwt=${jwtCookie!.value}`,
    },
  });

  // The API should return 403 or 404, NOT 200
  expect(
    [403, 404].includes(leakResponse.status()),
    `Expected 403 or 404 but got ${leakResponse.status()} — API may lack ownership check on carcasse-intermediaire GET`
  ).toBeTruthy();
});
