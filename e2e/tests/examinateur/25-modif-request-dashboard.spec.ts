import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({
  launchOptions: { slowMo: 100 },
  viewport: { width: 350, height: 667 },
  isMobile: true,
  hasTouch: true,
});

test('Examinateur dashboard alert modal + nav badge + grouping', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByRole('button', { name: 'Corriger le numéro de marquage' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({
    timeout: 10000,
  });

  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur$/);
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText("Le numéro de marquage d'une carcasse a été modifié.")).toBeVisible();

  await page.getByRole('button', { name: 'Plus tard' }).click();
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toHaveCount(
    0
  );
  await expect(page).toHaveURL(/\/app\/chasseur$/);

  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });

  await page.getByRole('button', { name: 'Voir la modification' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);
  await expect(page.getByRole('heading', { name: /Fiche du 07\/07.*CHASSENARD/ })).toBeVisible();
  await expect(page.getByText(/MM-001-001/).first()).toBeVisible();
  await expect(page.getByText(/MM-001-FIX/).first()).toBeVisible();
});

test('No pending demandes → no modal pop-up', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toHaveCount(
    0
  );
});
