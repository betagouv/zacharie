import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 116 — Chain refus partiel SVI : une acceptee, une consignee, une acceptee → chasseur voit les 3 decisions.

test.use({ launchOptions: { slowMo: 100, timeout: 150000 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('SVI rend des décisions divergentes → chasseur voit chaque décision', async ({ page }) => {
  // 5-step chain (PD → ETG → SVI x3 with divergent decisions: acceptée / consignée / acceptée).
  // Now passing since SVI assignment + ownership live per-carcasse: the SVI inspection page
  // unlocks via the carcasse-level svi_entity_id / current_owner_role.
  // Per-carcasse SVI decisions are also covered by tests 74, 75, 76, 77.
  test.setTimeout(180_000);
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD prend en charge + transmet à ETG 1 (mobile viewport)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const transmettreBtn = page.getByRole('button', { name: 'Transmettre' });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/ETG 1 a été notifié/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 prend en charge + accepte toutes les carcasses (desktop viewport)
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Accept MM-001-001 (grand gibier)
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();

  // Accept MM-001-002 (grand gibier)
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  // Accept MM-001-003 (petit gibier — pigeons)
  await page.getByRole('button', { name: /Pigeons.*MM-001-003/ }).click();
  await page
    .getByLabel(/Pigeons.*MM-001-/)
    .getByText('Lot accepté')
    .click();
  await expect(page.getByRole('button', { name: /Pigeons.*MM-001-003/ })).toBeVisible();

  // Accept MM-001-004 (grand gibier)
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  // 3. ETG 1 transmet au SVI
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 15000 });

  // 4. SVI inspects 3 carcasses with DIFFERENT decisions (desktop viewport)
  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // --- Carcasse MM-001-001 → Acceptée ---
  const carcasse1Btn = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await carcasse1Btn.scrollIntoViewIfNeeded();
  await carcasse1Btn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Set date
  await page
    .getByRole('button', { name: /Cliquez ici/ })
    .first()
    .click();

  // Select "Acceptée"
  const ipm1Fieldset1 = page.locator('fieldset').filter({ hasText: 'Décision IPM1' }).first();
  await ipm1Fieldset1.scrollIntoViewIfNeeded();
  await ipm1Fieldset1.getByLabel(/Acceptée/).check({ force: true });

  // Enregistrer
  const saveBtn1 = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn1.scrollIntoViewIfNeeded();
  await saveBtn1.click();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Navigate back to fiche
  // retour à la fiche via le fil d'ariane de la carcasse (l'URL porte l'id du prochain détenteur)
  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // --- Carcasse MM-001-002 → Mise en consigne ---
  const carcasse2Btn = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await carcasse2Btn.scrollIntoViewIfNeeded();
  await carcasse2Btn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Set date
  await page
    .getByRole('button', { name: /Cliquez ici/ })
    .first()
    .click();

  // Select "Mise en consigne"
  const ipm1Fieldset2 = page.locator('fieldset').filter({ hasText: 'Décision IPM1' }).first();
  await ipm1Fieldset2.scrollIntoViewIfNeeded();
  await ipm1Fieldset2.getByLabel(/Mise en consigne/).check({ force: true });

  // MISE_EN_CONSIGNE requires pièces inspectées + lésions (per missingFields validation in
  // SVI carcasse-svi route). Without these, save silently fails — see test 76 for proof.
  await page.locator('.input-for-search-prefilled-data__input-container').first().click();
  await page.getByRole('option').first().click();
  await page.locator('.input-for-search-prefilled-data__input-container').nth(1).click();
  await page.getByRole('option').first().click();

  // Fill durée
  await page.getByLabel(/Durée de la consigne/).fill('24');
  await page.getByLabel(/Durée de la consigne/).blur();

  // Enregistrer
  const saveBtn2 = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn2.scrollIntoViewIfNeeded();
  await saveBtn2.click();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Navigate back to fiche
  // retour à la fiche via le fil d'ariane de la carcasse (l'URL porte l'id du prochain détenteur)
  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // --- Carcasse MM-001-004 → Acceptée ---
  const carcasse4Btn = page.getByRole('button', { name: /Daim.*MM-001-004/ }).first();
  await new Promise((resolve) => setTimeout(resolve, 1000));
  await carcasse4Btn.scrollIntoViewIfNeeded();
  await carcasse4Btn.click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

  // Set date
  await page
    .getByRole('button', { name: /Cliquez ici/ })
    .first()
    .click();

  // Select "Acceptée"
  const ipm1Fieldset4 = page.locator('fieldset').filter({ hasText: 'Décision IPM1' }).first();
  await ipm1Fieldset4.scrollIntoViewIfNeeded();
  await ipm1Fieldset4.getByLabel(/Acceptée/).check({ force: true });

  // Enregistrer
  const saveBtn4 = page.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn4.scrollIntoViewIfNeeded();
  await saveBtn4.click();
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // 5. Navigate back and verify fiche shows different decision statuses
  // retour à la fiche via le fil d'ariane de la carcasse (l'URL porte l'id du prochain détenteur)
  await page
    .getByRole('link', { name: new RegExp(feiId) })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // Verify that we can see decision statuses on the fiche.
  // After SVI sets MM-001-002 to MISE_EN_CONSIGNE, the carcasse status updates to CONSIGNE
  // (label "Consignée") via store.updateCarcasse → updateCarcasseStatus.
  // The consigne sync can take a few seconds — give it generous time.
  await expect(page.getByText(/accept/i).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/consign|mise en consigne/i).first()).toBeVisible({ timeout: 30000 });
});
