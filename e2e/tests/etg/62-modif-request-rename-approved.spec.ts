import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

test('Rename marquage : ETG corrige → maj immédiate → examinateur confirme', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  const signalBtn = page.getByRole('button', { name: 'Corriger le numéro de marquage' });
  await signalBtn.scrollIntoViewIfNeeded();
  await signalBtn.click();

  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByLabel('Commentaire (optionnel)').fill('Le 1 et le F ont été confondus');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();

  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);

  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir la modification' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  await page.getByRole('link', { name: 'Voir la modification' }).first().click();
  await expect(page.getByRole('heading', { name: 'Numéro de marquage corrigé' })).toBeVisible();
  await expect(page.getByText('MM-001-001', { exact: true })).toBeVisible();
  await expect(page.getByText('MM-001-FIX', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Confirmer le numéro' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);
  await expect(page.getByText(/Aucune demande en cours/)).toBeVisible({ timeout: 10000 });

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);
  await expect(page.getByText('Numéro de marquage corrigé')).toHaveCount(0);
  await expect(page.getByText('1 modification').first()).toBeVisible();

  await page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' }).click();
  await expect(page.getByText(/Numéro de marquage confirmé : MM-001-FIX/).first()).toBeVisible();
});
