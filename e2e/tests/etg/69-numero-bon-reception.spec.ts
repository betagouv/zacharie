import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('ETG');
});

// Scenario 69 — N° de bon de réception
// L'ETG le saisit une fois au contrôle à réception ; il est reporté sur chaque carcasse
// prise en charge et reste lisible par le SVI après transmission.
test('69 - ETG saisit le n° de bon de réception, le SVI le voit après transmission', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  const numeroBonReception = 'BR-2025-0042';

  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();

  const bonReceptionInput = page.getByLabel('N° de bon de réception');
  await bonReceptionInput.scrollIntoViewIfNeeded();
  await bonReceptionInput.fill(numeroBonReception);
  await bonReceptionInput.blur();

  const dateShortcut = page.getByRole('button', { name: 'Cliquez ici pour définir' });
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();
  const enregistrer = page.getByRole('button', { name: 'Enregistrer' });
  await enregistrer.scrollIntoViewIfNeeded();
  await enregistrer.click();

  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
  await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
  await expect(page.getByText('SVI 1 a été notifié')).toBeVisible({ timeout: 10000 });

  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

  await expect(page.getByText(`N° de bon de réception : ${numeroBonReception}`)).toBeVisible({
    timeout: 10000,
  });
});
