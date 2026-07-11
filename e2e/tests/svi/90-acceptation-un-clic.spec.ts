import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Acceptation en un clic côté SVI : le bouton « Accepter » des cartes carcasse
// (fiche SVI + page carcasse) enregistre une IPM1 avec la décision « Acceptée »
// sans passer par le formulaire (useApproveCarcasse).

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

    // L'acceptation déclenche une synchro backend : on l'attend pour éviter un faux positif local-only.
    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 15000 }
    );
    await accepterBtn.click();

    // Le clic ne doit PAS naviguer vers la page carcasse (la carte entière est un bouton de navigation).
    await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));

    // La carte affiche la décision IPM1 « Acceptée » et le statut accepté ; le bouton disparaît.
    await expect(carcasseCard.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({ timeout: 10000 });
    await expect(carcasseCard.getByText('accepté', { exact: true })).toBeVisible();
    await expect(accepterBtn).toBeHidden();

    // Les autres carcasses du groupe ne sont PAS acceptées pour autant.
    const autreCarcasse = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await expect(autreCarcasse.getByRole('button', { name: 'Accepter' })).toBeVisible();

    await syncResponse;

    // Reconnexion : vide le store local et force un re-fetch depuis le backend.
    // La décision doit avoir été persistée côté serveur.
    await logoutAndConnect(page, 'svi@example.fr');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    const cardApresReconnexion = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    await expect(cardApresReconnexion.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({
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

    // Cliquer sur le corps de la carte (hors bouton « Accepter ») navigue vers la page carcasse.
    const carcasseCard = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await carcasseCard.scrollIntoViewIfNeeded();
    await carcasseCard.getByText('N° MM-001-002').click();
    await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);

    // Sans décision, la page propose la section « Accepter la carcasse ».
    await expect(page.getByText('Accepter la carcasse')).toBeVisible();

    const accepterBtn = page.getByRole('button', { name: 'Accepter', exact: true });
    await accepterBtn.scrollIntoViewIfNeeded();
    const syncResponse = page.waitForResponse(
      (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
      { timeout: 15000 }
    );
    await accepterBtn.click();

    // Une fois acceptée, la section devient « Résumé de la décision » avec l'IPM1 « Acceptée ».
    await expect(page.getByText('Résumé de la décision')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/Décision IPM1 : Acceptée/)).toBeVisible();
    await expect(accepterBtn).toBeHidden();

    await syncResponse;
  });
});

test.describe('après transmission ETG → SVI (prise de responsabilité)', () => {
  test.beforeEach(async () => {
    await resetDb('ETG');
  });

  // L'acceptation en un clic avant toute autre action du SVI doit aussi faire passer
  // l'ownership de la transmission au SVI (current_owner_role !== SVI au moment du clic),
  // comme le fait l'enregistrement d'une IPM1 via le formulaire.
  test("90 - SVI : accepter en un clic prend la responsabilité de la transmission", async ({ page }) => {
    const feiId = 'ZACH-20250707-QZ6E0-165242';

    // 1. ETG prend en charge + transmet au SVI (flux réel, pas de seed direct).
    await connectWith(page, 'etg-1@example.fr');
    await page.getByRole('link', { name: feiId }).click();
    await page.getByRole('button', { name: 'Prendre en charge' }).click();
    await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
    await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
    await page.getByRole('option', { name: 'SVI 1 - 75000 Paris (Service' }).click();
    await page.getByRole('button', { name: 'Transmettre la fiche' }).click();
    await expect(page.getByText(/SVI 1 a été notifié/)).toBeVisible({ timeout: 15000 });

    // 2. Le SVI accepte une carcasse en un clic, directement depuis la fiche.
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
    await expect(carcasseCard.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({ timeout: 10000 });
    await syncResponse;

    // 3. Reconnexion : la transmission appartient désormais au SVI, la fiche et ses carcasses
    // restent visibles, la décision est persistée, les autres carcasses restent sans décision.
    await logoutAndConnect(page, 'svi@example.fr');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
    await page.getByRole('link', { name: feiId }).click();
    const cardApresReconnexion = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
    await expect(cardApresReconnexion.getByText(/Décision IPM1 : Acceptée/)).toBeVisible({
      timeout: 10000,
    });
    const autreCarcasse = page.getByRole('button', { name: /Daim.*MM-001-002/ }).first();
    await expect(autreCarcasse.getByRole('button', { name: 'Accepter' })).toBeVisible();
  });
});
