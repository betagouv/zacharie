import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 124 — Deux chaînes SVI parallèles.
// Dispatch 2+2 to ETG 1 + ETG 2. ETG 1 → SVI 1, ETG 2 → SVI 2 in parallel. Each SVI must only
// see its own branch's carcasses.
//
// ⚠️ BACKEND LIMITATION (skip reason): the data model does NOT support multi-branch parallel SVI
// assignment today. `svi_assigned_at` and `svi_entity_id` are fei-level fields (one per Fei
// record), not per-branch / per-CarcasseIntermediaire. Once ETG 1 transmits to SVI 1:
//   • `fei.svi_assigned_at` gets set, which excludes the fei from `feisToTake` / `feisOngoing`
//     queries (api-express/src/controllers/fei.ts:941,977) — so ETG 2 loses access to the fei.
//   • Even if ETG 2 took charge before ETG 1's transmission (so the fei appears in their
//     `feisDone` via their CarcasseIntermediaire records), ETG 2's later transmission to SVI 2
//     would OVERWRITE `fei.svi_entity_id` (SVI 1 → SVI 2), breaking SVI 1's view of the fei.
//
// To unskip: backend needs to track SVI assignment per-branch (per-CarcasseIntermediaire or via
// per-branch fei-state), not at the fei level. Tracked for the upcoming backend refactor.

test.use({ launchOptions: { slowMo: 100 } });
test.setTimeout(240_000);

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.skip('SVI 1 et SVI 2 voient chacun leur branche seulement', async ({ page }) => {
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD dispatches 2+2 to ETG 1 + ETG 2 (mobile viewport)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  // Group 1 → ETG 1 (keeps MM-001-003 + MM-001-004 by default)
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();

  // Add group 2 → moves MM-001-001 + MM-001-002 to ETG 2
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

  // 2. ETG 1: take charge → accept MM-001-003 (Pigeons) + MM-001-004 (Daim) → transmit to SVI 1
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // Accept MM-001-003 (Pigeons → Lot accepté)
  await page.getByRole('button', { name: /Pigeons.*MM-001-003/ }).click();
  await page
    .getByLabel(/Pigeons.*MM-001-/)
    .getByText('Lot accepté')
    .click();
  await expect(page.getByRole('button', { name: /Pigeons.*MM-001-003/ })).toBeVisible();

  // Accept MM-001-004 (Daim → Carcasse acceptée)
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 15000 });

  // 3. ETG 2: take charge → accept MM-001-001 (Daim) + MM-001-002 (Daim) → transmit to SVI 2
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge les carcasses' })).not.toBeVisible({
    timeout: 10000,
  });

  // Accept MM-001-001 (Daim)
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();

  // Accept MM-001-002 (Daim)
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 2 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 2 a été notifié')).toBeVisible({ timeout: 15000 });

  // 4. SVI 1: sees only ETG 1's carcasses (MM-001-003, MM-001-004), not ETG 2's
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();

  // 5. SVI 2: sees only ETG 2's carcasses (MM-001-001, MM-001-002), not ETG 1's
  await logoutAndConnect(page, 'svi-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();
});
