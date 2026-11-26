import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.describe('depuis la fiche SVI', () => {
  test.beforeEach(async () => {
    await resetDb('SVI');
  });

  test('90 - SVI : accepter une carcasse en un clic depuis la liste de la fiche', async ({ page }) => {
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    await connectWith(page, 'svi@example.fr');
    await expect(page).toHaveURL(/\/app\/svi/);

    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

    const carcasseCard = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    const accepterBtn = carcasseCard.getByRole('button', { name: 'Accepter' });
    await accepterBtn.scrollIntoViewIfNeeded();

    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 15000 }
    );
    await accepterBtn.click();

    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

    await expect(carcasseCard.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });
    await expect(carcasseCard.getByText('accepté', { exact: true })).toBeVisible();
    await expect(accepterBtn).toBeHidden();

    const autreCarcasse = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await expect(autreCarcasse.getByRole('button', { name: 'Accepter' })).toBeVisible();

    await syncResponse;

    await logoutAndConnect(page, 'svi@example.fr');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    const cardApresReconnexion = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    await expect(cardApresReconnexion.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({
      timeout: 10000,
    });
    await expect(cardApresReconnexion.getByRole('button', { name: 'Accepter' })).toBeHidden();
  });

  test('90 - SVI : accepter une carcasse en un clic depuis la page carcasse', async ({ page }) => {
    const feiId = 'ZACH-20250707-QZ6E0-185242';
    await connectWith(page, 'svi@example.fr');

    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

    const carcasseCard = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await carcasseCard.scrollIntoViewIfNeeded();
    await carcasseCard.getByText('N° MM-001-002').click();
    await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

    await expect(page.getByText('Accepter la carcasse')).toBeVisible();

    const accepterBtn = page.getByRole('button', { name: 'Accepter', exact: true });
    await accepterBtn.scrollIntoViewIfNeeded();
    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 15000 }
    );
    await accepterBtn.click();

    await expect(page.getByText('Résumé de la décision')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible();
    await expect(accepterBtn).toBeHidden();

    await syncResponse;
  });
});

test.describe('après transmission ETG → SVI (prise de responsabilité)', () => {
  test.beforeEach(async () => {
    await resetDb('ETG');
  });

  test('90 - SVI : accepter en un clic prend la responsabilité de la transmission', async ({ page }) => {
    const feiId = 'ZACH-20250707-QZ6E0-165242';

    await connectWith(page, 'etg-1@example.fr');
    await page.getByRole('link', { name: feiId }).click();
    await page.getByRole('button', { name: 'Prendre en charge' }).click();
    await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
    await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
    await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
    await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
    await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

    await logoutAndConnect(page, 'svi@example.fr');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
    await page.getByRole('link', { name: feiId }).click();
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

    const carcasseCard = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    const accepterBtn = carcasseCard.getByRole('button', { name: 'Accepter' });
    await accepterBtn.scrollIntoViewIfNeeded();
    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 15000 }
    );
    await accepterBtn.click();
    await expect(carcasseCard.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });
    await syncResponse;

    await logoutAndConnect(page, 'svi@example.fr');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    const cardApresReconnexion = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    await expect(cardApresReconnexion.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({
      timeout: 10000,
    });
    const autreCarcasse = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await expect(autreCarcasse.getByRole('button', { name: 'Accepter' })).toBeVisible();
  });
});
