import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';
import { ajouterVenteDon } from '../../utils/vente-don';

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

  // Vente / don 1 : ETG 1, toutes les carcasses par défaut.
  await ajouterVenteDon(page, { destinataire: /ETG 1 - 75000 Paris \(/ });

  // Vente / don 2 : ETG 2, qui reprend 2 carcasses à l'ETG 1.
  await ajouterVenteDon(page, { destinataire: /ETG 2 - 75000 Paris \(/, carcasses: [0, 1] });

  const transmettre = page.getByRole('button', { name: /^Transmettre/ });
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
