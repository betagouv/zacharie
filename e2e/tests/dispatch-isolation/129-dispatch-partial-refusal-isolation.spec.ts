import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 129 — Refus partiel par ETG 1 ne pollue pas la vue ETG 2.
//
// Sister to 122 (which only tests cross-ETG visibility *before* any refusal):
// here ETG 1 actively REFUSES one of its 2 carcasses with a motif. ETG 2's
// view must remain pristine — neither the refused carcasse (MM-001-003) nor
// the refusal status itself must appear in ETG 2's UI.
//
// Why this matters for the fetch refactor: today, isolation works because
// carcasses are scoped via CarcasseIntermediaire entity relation. After the
// flip to carcasse-first fetches, this is *the* boundary preventing refusal
// leakage. If the refactor breaks here, ETG 2 sees ETG 1's private decisions.

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("Le refus d'une carcasse par ETG 1 reste invisible pour ETG 2", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // -------------------------------------------------------------------------
  // 1. PD dispatches: group 1 (MM-001-003/004) → ETG 1, group 2 (MM-001-001/002) → ETG 2
  // -------------------------------------------------------------------------
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();

  // Group 1 → ETG 1 (defaults to the first 2 carcasses MM-001-003/004)
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const g1s = page.getByText('Pas de stockage').first();
  await g1s.scrollIntoViewIfNeeded();
  await g1s.click();
  const g1t = page.getByText('Je transporte les carcasses moi').first();
  await g1t.scrollIntoViewIfNeeded();
  await g1t.click();

  // Group 2 → ETG 2 (manually pick the remaining 2)
  const add = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await add.scrollIntoViewIfNeeded();
  await add.click();
  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Btns = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Btns.nth(0).click();
  await g2Btns.nth(1).click();
  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 2 - 75000 Paris (' }).click();
  const g2s = group2.getByText('Pas de stockage').first();
  await g2s.scrollIntoViewIfNeeded();
  await g2s.click();
  const g2t = group2.getByText('Je transporte les carcasses moi').first();
  await g2t.scrollIntoViewIfNeeded();
  await g2t.click();

  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // -------------------------------------------------------------------------
  // 2. ETG 1 takes charge and refuses MM-001-003 with motif "Présence de souillures"
  // -------------------------------------------------------------------------
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });

  // why: react-dsfr modal storms when first carcasse panel opens
  await new Promise((r) => setTimeout(r, 500));

  await page.getByRole('button', { name: /Daim N° MM-001-004 Mise à/ }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse refusée').click();
  await page.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByRole('button', { name: 'Enregistrer' }).click();

  // Confirm refusal status now shows on ETG 1's own view (sanity)
  await expect(page.getByText(/Refusée par ETG 1|Refus de 1 carcasse/i).first()).toBeVisible({
    timeout: 10000,
  });

  // -------------------------------------------------------------------------
  // 3. ETG 2 connects and the refusal must be invisible from their side
  // -------------------------------------------------------------------------
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });

  // ETG 2 sees ONLY their group (001/002), never the refused 003 or its partner 004
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();

  // CRITICAL: no trace of "Refusée par ETG 1" or "Présence de souillures" leaks to ETG 2
  await expect(page.getByText(/Refusée par ETG 1/i)).not.toBeVisible();
  await expect(page.getByText(/Présence de souillures/i)).not.toBeVisible();

  // ETG 2 can still independently take charge of their carcasses — refusal in
  // group 1 must not stall the parallel branch.
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
});
