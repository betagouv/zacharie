import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(180_000);

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('ETG 1 voit 2 transmissions isolées pour le même examen initial', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i, carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/, { timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ }).click();
  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  const collecteurStockage = page.getByText('Pas de stockage').first();
  await collecteurStockage.scrollIntoViewIfNeeded();
  await collecteurStockage.click();
  const transmettreCollecteur = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreCollecteur.scrollIntoViewIfNeeded();
  await transmettreCollecteur.click();
  await expect(page.getByText(/ETG 1.*notifié|fiche.*transmise/i).first()).toBeVisible({ timeout: 15000 });

  await logoutAndConnect(page, 'etg-1@example.fr');
  await expect(page).toHaveURL(/\/app\/etg/, { timeout: 15000 });

  const feiCards = page.getByRole('link', { name: feiId });
  await expect(feiCards).toHaveCount(2, { timeout: 15000 });

  await expect(feiCards.filter({ hasText: 'Collecteur Pro 1' })).toHaveCount(1);
  await expect(feiCards.filter({ hasNotText: 'Collecteur Pro 1' })).toHaveCount(1);

  await feiCards.filter({ hasText: 'Collecteur Pro 1' }).click();
  const priseEnChargeCollecteur = page.getByRole('button', { name: 'Prendre en charge' });
  await priseEnChargeCollecteur.scrollIntoViewIfNeeded();
  await priseEnChargeCollecteur.click();
  await expect(priseEnChargeCollecteur).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();

  await page.goto('http://localhost:3290/app/etg');
  const feiCardsAgain = page.getByRole('link', { name: feiId });
  await expect(feiCardsAgain).toHaveCount(2, { timeout: 15000 });
  await feiCardsAgain.filter({ hasNotText: 'Collecteur Pro 1' }).click();
  const priseEnChargeDirecte = page.getByRole('button', { name: 'Prendre en charge' });
  await priseEnChargeDirecte.scrollIntoViewIfNeeded();
  await priseEnChargeDirecte.click();
  await expect(priseEnChargeDirecte).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();
});
