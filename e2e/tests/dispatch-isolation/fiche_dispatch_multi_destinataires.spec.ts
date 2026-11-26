import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';
import { ajouterVenteDon } from '../../utils/vente-don';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Dispatch 4 carcasses vers 2 destinataires ETG', async ({ page, context }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris', carcasses: [0, 1] });

  await expect(page.getByText('1 carcasse + 1 lot')).toBeVisible();
  await expect(page.getByText('2 carcasses')).toBeVisible();

  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText(/ETG 1.*1 carcasse \+ 1 lot/)).toBeVisible();
  await expect(page.getByText(/ETG 2.*2 carcasse/)).toBeVisible();

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible();

  const priseEnChargeBtn = page.getByRole('button', { name: 'Prendre en charge' });
  await expect(priseEnChargeBtn).toBeVisible();
  await priseEnChargeBtn.click();

  await expect(priseEnChargeBtn).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Carcasses (2)')).toBeVisible();

  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText('Carcasses (2)')).toBeVisible();
  const priseEnChargeBtn2 = page.getByRole('button', { name: 'Prendre en charge' });
  await expect(priseEnChargeBtn2).toBeVisible();
  await priseEnChargeBtn2.click();
  await expect(priseEnChargeBtn2).not.toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Carcasses (2)')).toBeVisible();
});
