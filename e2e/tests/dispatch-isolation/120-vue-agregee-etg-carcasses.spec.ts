import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.setTimeout(120_000);

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('/etg/carcasses ne montre que les carcasses dispatchées à cet ETG', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD takes charge and dispatches 2 ETG x 2 carcasses
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  await page.getByRole('link', { name: feiId }).click();

  // Vente / don 1 : ETG 1 (toutes les carcasses par défaut)
  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris (' });

  // Vente / don 2 : ETG 2, qui reprend 2 carcasses à l'ETG 1
  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris (', carcasses: [0, 1] });

  // Les cartes récapitulent la répartition
  await expect(page.getByText('1 carcasse + 1 lot')).toBeVisible();
  await expect(page.getByText('2 carcasses')).toBeVisible();

  // Submit
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });

  // 2. Login as ETG 1, take charge, then check carcasses page
  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible({ timeout: 10000 });

  // Take charge
  const priseEnChargeBtn = page.getByRole('button', { name: 'Prendre en charge' });
  await expect(priseEnChargeBtn).toBeVisible();
  await priseEnChargeBtn.click();
  await expect(priseEnChargeBtn).not.toBeVisible({ timeout: 10000 });

  // Now go to /app/etg/carcasses and check only 2 are visible
  await page.goto('http://localhost:3290/app/etg/carcasses');
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/, { timeout: 10000 });

  // Wait for carcasses to load and verify count shows 2
  await expect(page.getByText('2 carcasses').nth(0)).toBeVisible({ timeout: 15000 });
});
