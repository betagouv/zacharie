import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({ launchOptions: { slowMo: 100 } });
test.setTimeout(240_000);

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('SVI 1 et SVI 2 voient chacun leur branche seulement', async ({ page }) => {
  page.on('dialog', (d) => d.accept().catch(() => {}));
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await ajouterVenteDon(page, { destinataire: 'ETG 1 - 75000 Paris' });

  await ajouterVenteDon(page, { destinataire: 'ETG 2 - 75000 Paris', carcasses: [0, 1] });
  const transmettreBtn = page.getByRole('button', { name: /Transmettre/ });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: /Pigeons.*MM-001-003/ }).click();
  await page
    .getByLabel(/Pigeons.*MM-001-/)
    .getByText('Lot accepté')
    .click();
  await expect(page.getByRole('button', { name: /Pigeons.*MM-001-003/ })).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 15000 });

  await logoutAndConnect(page, 'etg-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByRole('button', { name: 'Prendre en charge' })).not.toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 2 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 2 a été notifié')).toBeVisible({ timeout: 15000 });

  await logoutAndConnect(page, 'svi@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText('MM-001-003').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();
  await expect(page.getByText('MM-001-001')).not.toBeVisible();
  await expect(page.getByText('MM-001-002')).not.toBeVisible();

  await logoutAndConnect(page, 'svi-2@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003')).not.toBeVisible();
  await expect(page.getByText('MM-001-004')).not.toBeVisible();
});
