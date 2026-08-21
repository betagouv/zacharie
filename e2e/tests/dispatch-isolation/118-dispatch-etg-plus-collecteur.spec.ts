import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 118 — Dispatch ETG + collecteur : isolation croisée.
// ETG 1 ne voit pas les carcasses du collecteur, collecteur ne voit pas celles de l'ETG.
// Group 1 (ETG 1) keeps MM-001-003, MM-001-004.
// Group 2 (Collecteur) gets MM-001-001, MM-001-002.

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('ETG et collecteur ne voient que leur branche', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  // Group 1 : ETG 1
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Ajouter group 2
  // Move MM-001-001 and MM-001-002 to group 2
  // Group 2 : Collecteur Pro 1
  // Collecteur still needs stockage selection
  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i, carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // ETG 1 voit 2 carcasses (003/004), ne voit PAS 001/002 (celles du collecteur)
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();

  // Collecteur voit 2 carcasses (001/002)
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/, { timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });
});
