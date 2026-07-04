import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

// PR #399 — per-carcasse `next_owner_entity_id` (not FEI-level).
// Spec #28 already exercises two-group dispatch (ETG + collecteur), but the recipients are
// different ROLES. This test sends to two recipients of the SAME role (ETG 1 and ETG 2) to
// rule out a regression where the code falls back to fei.fei_next_owner_entity_id and silently
// sends everything to a single recipient — both ETGs would still see *something*, but visible
// carcasse counts wouldn't add up.
test('Dispatch to two ETGs : each receives a disjoint subset of carcasses', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Groupe 1 : ETG 1 (premier groupe sélectionne automatiquement les carcasses par défaut)
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").first().click();
  await page.getByRole('option', { name: /ETG 1 - 75000 Paris \(/ }).click();
  const g1PasDeStockage = page.getByText('Pas de stockage').first();
  await g1PasDeStockage.scrollIntoViewIfNeeded();
  await g1PasDeStockage.click();
  const g1Transport = page.getByText('Je transporte les carcasses moi').first();
  await g1Transport.scrollIntoViewIfNeeded();
  await g1Transport.click();

  // Ajouter groupe 2
  const ajouter = page.getByRole('button', { name: 'Ajouter un autre destinataire' });
  await ajouter.scrollIntoViewIfNeeded();
  await ajouter.click();

  // Groupe 2 : ETG 2. Pick the first 2 carcasses left in the unassigned pool of group 2.
  const group2 = page.locator('div.rounded.border').nth(1);
  await group2.scrollIntoViewIfNeeded();
  const g2Carcasses = group2.locator("button[type='button']").filter({ hasText: 'N°' });
  await g2Carcasses.nth(0).click();
  await g2Carcasses.nth(1).click();

  await group2.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /ETG 2 - 75000 Paris \(/ }).click();
  const g2Stockage = group2.getByText('Pas de stockage').first();
  await g2Stockage.scrollIntoViewIfNeeded();
  await g2Stockage.click();
  const g2Transport = group2.getByText('Je transporte les carcasses moi').first();
  await g2Transport.scrollIntoViewIfNeeded();
  await g2Transport.click();

  const transmettre = page.getByRole('button', { name: /Transmettre/ });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // ETG 1 sees only ITS carcasses. If per-carcasse next_owner_entity_id had collapsed to a single
  // FEI-level value, ETG 1 would see all 4 (the latest dispatch would win) — the count assertions
  // below catch that regression directly.
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });

  // ETG 2 sees the disjoint half. Total = 4 across the two ETGs.
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
});
