import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 119 — Dispatch 3 destinataires : ETG 1 / ETG 2 / Collecteur 1.
// Seed has 4 carcasses. Split: group 1 keeps 2, group 2 gets 1, group 3 gets 1.
// Clicking nth(0) in group 2 moves MM-001-001 to group 2.
// Clicking nth(0) in group 3 moves the next available first button to group 3.
// After group 2 takes MM-001-001: group 1 has 003/004/002, group 2 has 001.
// Then group 3 nth(0) moves MM-001-002 to group 3 (first not-in-group-3 button).
// Result: group 1 (ETG 1) = 003/004, group 2 (ETG 2) = 001, group 3 (Collecteur) = 002.

test.setTimeout(150_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Split 4 carcasses entre ETG 1 / ETG 2 / Collecteur Pro 1', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Group 1 : ETG 1 (starts with all 4 carcasses)
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Ajouter group 2 : ETG 2
  // Move 1 carcasse (MM-001-001) to group 2
  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0] });

  // Ajouter group 3 : Collecteur Pro 1
  // Move 1 carcasse (MM-001-002, which is nth(1)) to group 3
  // nth(0) would be MM-001-001 which is already in group 2 - clicking it would steal from group 2
  // Collecteur needs stockage selection
  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i, carcasses: [1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // Chaque destinataire ne voit que son lot
  await page.setViewportSize({ width: 1280, height: 900 });

  // ETG 1: group 1 kept 2 carcasses (003/004)
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });

  // ETG 2: group 2 got 1 carcasse (001)
  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (1)')).toBeVisible({ timeout: 10000 });

  // Collecteur: group 3 got 1 carcasse (002)
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (1)')).toBeVisible({ timeout: 10000 });
});
