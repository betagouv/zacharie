import { test, expect } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 111 — Chain circuit long : PD → ETG → SVI (verifies handoff chain).
// Uses PREMIER_DETENTEUR seed (examinateur already created + transmitted the fiche).

test.use({ launchOptions: { slowMo: 100 } });

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test('Chain circuit long complet : PD → ETG → SVI', async ({ page }) => {
  test.setTimeout(180_000);
  const feiId = 'ZACH-20250707-QZ6E0-155242';

  // 1. PD prend en charge + transmet a ETG 1
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'premier-detenteur@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge cette' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'ETG 1 - 75000 Paris (' }).click();
  const pasDeStockage = page.getByText('Pas de stockage').first();
  await pasDeStockage.scrollIntoViewIfNeeded();
  await pasDeStockage.click();
  const jeTransporte = page.getByText('Je transporte les carcasses moi').first();
  await jeTransporte.scrollIntoViewIfNeeded();
  await jeTransporte.click();
  const transmettreBtn = page.getByRole('button', { name: 'Transmettre' });
  await transmettreBtn.scrollIntoViewIfNeeded();
  await transmettreBtn.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 15000 });

  // 2. ETG 1 prend en charge, process carcasses, transmet au SVI
  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge les carcasses' }).click();
  await new Promise((resolve) => setTimeout(resolve, 500));

  // Accept MM-001-001
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-001').getByText('Carcasse acceptée').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toBeVisible();

  // Refuse MM-001-002
  await page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByText('Carcasse refusée').click();
  await page.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: 'Présence de souillures' }).click();
  await page.getByLabel('Daim - N° MM-001-002').getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toBeVisible();

  // Mark MM-001-004 as manquante
  await page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' }).click();
  await page.getByLabel('Daim - N° MM-001-004').getByText('Carcasse manquante').click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-004 Mise à' })).toBeVisible();

  // Set date and select SVI
  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 15000 });

  // 3. SVI sees the fiche
  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
});
