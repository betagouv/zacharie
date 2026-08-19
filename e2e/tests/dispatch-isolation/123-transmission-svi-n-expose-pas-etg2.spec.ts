import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 123 — Transmission ETG 1 → SVI 1 n'expose pas les carcasses de la branche ETG 2.
// Dispatch 2+2 to ETG 1 + ETG 2. ETG 1 accepts + transmits to SVI 1. ETG 2 keeps its carcasses
// (no transmission). SVI 1 should ONLY see ETG 1's carcasses (MM-001-003, MM-001-004), never the
// ones still at ETG 2 (MM-001-001, MM-001-002).

test.use({ launchOptions: { slowMo: 100 } });
test.setTimeout(180_000);

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test("SVI destinataire d'ETG 1 ne voit que les 2 carcasses d'ETG 1", async ({ page }) => {
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD dispatches 2+2 to ETG 1 + ETG 2 (mobile viewport) — pattern from test 117
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Group 1 → ETG 1 (keeps MM-001-003 + MM-001-004 by default)
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Add group 2 → moves the first 2 listed carcasses (MM-001-001 + MM-001-002) to ETG 2
  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1: take charge, accept MM-001-003 (Pigeons) + MM-001-004 (Daim), transmit to SVI 1
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });

  // Accept MM-001-003 (petit gibier, pigeons → "Lot accepté")
  await page.getByRole('button', { name: /Pigeons.*MM-001-003/ }).click();
  await page
    .getByLabel(/Pigeons.*MM-001-/)
    .getByText('Lot accepté')
    .click();
  await expect(page.getByRole('button', { name: /Pigeons.*MM-001-003/ })).toBeVisible();

  // Accept MM-001-004 (gros gibier, daim → "Carcasse acceptée")
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  // Transmit to SVI 1
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 15000 });

  // 3. SVI 1 logs in and opens the fiche → should ONLY see ETG 1's branch (MM-001-003 + MM-001-004)
  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  // ETG 1's carcasses are visible (transmitted to SVI 1)
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();

  // ETG 2's carcasses are NOT visible (still at ETG 2, never transmitted to any SVI)
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();
});
