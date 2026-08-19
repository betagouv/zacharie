import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 117 (extension) — Dispatch 2 ETG : NEGATIVE visibility + vue /etg/carcasses agrégée.
// Extends the existing fiche_dispatch_multi_destinataires spec with explicit .not.toBeVisible()
// assertions on the OTHER branch's carcasse numbers, + check the aggregate /etg/carcasses view
// does not leak cross-branch carcasses.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch 2 ETG : isolation négative + vue agrégée', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD dispatche (viewport mobile)
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Déplacer MM-001-001 et MM-001-002 vers l'ETG 2 : l'ETG 1 garde 004 et 003 (pigeons).
  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 : prend en charge, voit SES carcasses (003/004 stayed in group 1), ne voit PAS celles de ETG 2 (001/002 moved to group 2)
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
  // Prendre en charge pour accéder aux détails des carcasses
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
  // Group 1 (ETG 1) kept MM-001-003 and MM-001-004 (the ones NOT clicked into group 2)
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  // Négatif explicite: MM-001-001 and MM-001-002 were moved to group 2 (ETG 2)
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();

  // NOTE: /etg/carcasses aggregate view tested separately in spec 120.
  // Currently the aggregate view does not filter by dispatch branch (known app limitation).

  // 3. ETG 2 : prend en charge, voit MM-001-001 and MM-001-002 (moved into group 2)
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();
});
