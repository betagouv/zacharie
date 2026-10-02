import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Une modification locale pas encore envoyée au serveur (is_synced = false) ne doit pas être écrasée
// par la version serveur quand loadCarcasses ramène cette carcasse dans un delta.
//
// Deux sessions du même agent SVI (deux appareils) :
// - A accepte MM-001-001 en un clic, mais sa synchro échoue (/sync répond 500). syncData appelle
//   quand même loadCarcasses dans son `finally` : c'est ce pull qui écrasait la modification de A.
// - B (autre appareil, synchro OK) met MM-001-001 en consigne : la ligne serveur bouge après le
//   curseur de A, donc le pull suivant de A ramène cette carcasse.
// - A recharge la page (pull, /sync toujours en 500) : sa décision « Acceptée » doit rester affichée.
// - /sync revient : la décision de A part au serveur, B la voit après reconnexion.
//
// Le 500 sur /sync est indispensable : sans lui, A pousserait sa modification avant de tirer la
// version de B, et le pull ne trouverait plus de copie locale non synchronisée à préserver.

test.setTimeout(180_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI');
});

const feiId = 'ZACH-20250707-QZ6E0-185242';
const API_URL = 'http://localhost:3291';

// Pull de loadCarcasses (GET /carcasse?after=...), distinct de GET /carcasse/:id.
function waitForPull(page: Page) {
  return page.waitForResponse(
    (resp) => new URL(resp.url()).pathname === '/carcasse' && resp.request().method() === 'GET',
    { timeout: 15000 }
  );
}

function waitForSyncOk(page: Page) {
  return page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
}

test('154 - une acceptation SVI non envoyée survit au pull qui ramène la carcasse modifiée ailleurs', async ({
  page,
  browser,
}) => {
  // 1. A ouvre la fiche, puis /sync tombe en panne pour A.
  await connectWith(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  const carteA = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await expect(carteA.getByRole('button', { name: 'Accepter' })).toBeVisible({ timeout: 10000 });

  const corsHeaders = {
    'Access-Control-Allow-Origin': 'http://localhost:3290',
    'Access-Control-Allow-Credentials': 'true',
  };
  await page.route(`${API_URL}/sync`, (route) => {
    if (route.request().method() === 'OPTIONS') {
      return route.fulfill({
        status: 204,
        headers: {
          ...corsHeaders,
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': route.request().headers()['access-control-request-headers'] ?? '*',
        },
      });
    }
    return route.fulfill({
      status: 500,
      contentType: 'application/json',
      headers: corsHeaders,
      body: JSON.stringify({ ok: false, data: null, error: 'Erreur simulée' }),
    });
  });

  // 2. A accepte MM-001-001 : la décision s'affiche localement, la synchro échoue.
  const accepterA = carteA.getByRole('button', { name: 'Accepter' });
  await accepterA.scrollIntoViewIfNeeded();
  const premierPullA = waitForPull(page);
  await accepterA.click();
  await expect(carteA.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });
  await premierPullA;

  // 3. B (autre appareil, même compte) met MM-001-001 en consigne, synchro OK.
  const contextB = await browser.newContext();
  const pageB = await contextB.newPage();
  await connectWith(pageB, 'svi@example.fr');
  await expect(pageB.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await pageB.getByRole('link', { name: feiId }).click();
  const carteB = pageB.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await carteB.scrollIntoViewIfNeeded();
  await carteB.getByText('N° MM-001-001').click();
  await expect(pageB).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await expect(pageB.getByText(/Inspection Post-Mortem 1/)).toBeVisible();
  await expect(pageB.getByLabel('Mise en consigne', { exact: true })).toBeChecked();

  const dateShortcut = pageB.getByRole('button', { name: /Cliquez ici/ }).first();
  await dateShortcut.scrollIntoViewIfNeeded();
  await dateShortcut.click();
  await pageB.locator('.input-for-search-prefilled-data__input-container').first().click();
  await pageB.getByRole('option').first().click();
  await pageB.locator('.input-for-search-prefilled-data__input-container').nth(1).click();
  await pageB.getByRole('option').first().click();
  await pageB.getByLabel(/Durée de la consigne/).fill('24');
  await pageB.getByLabel(/Durée de la consigne/).blur();

  pageB.once('dialog', (d) => d.accept());
  const syncB = waitForSyncOk(pageB);
  const saveBtn = pageB.getByRole('button', { name: 'Enregistrer' }).first();
  await saveBtn.scrollIntoViewIfNeeded();
  await saveBtn.click();
  await expect(pageB.getByText(/Inspection Post-Mortem 2/)).toBeVisible({ timeout: 10000 });
  await syncB;

  // 4. A recharge : /sync échoue encore, le pull ramène la version consignée de B.
  const pullApresRechargement = waitForPull(page);
  await page.reload();
  await pullApresRechargement;
  // Ouvrir la carcasse relance un loadData : une fois son pull revenu, le merge précédent est
  // forcément appliqué au store (sinon l'assertion pourrait passer avant l'écrasement).
  const carteApresPull = page.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await carteApresPull.scrollIntoViewIfNeeded();
  const pullPageCarcasse = waitForPull(page);
  await carteApresPull.getByText('N° MM-001-001').click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasse-svi\//);
  await pullPageCarcasse;
  await expect(page.getByText(/Décision IPM1\s*:\s*Acceptée/).first()).toBeVisible({ timeout: 10000 });

  // 5. /sync revient : la décision de A part au serveur.
  await page.unroute(`${API_URL}/sync`);
  const syncA = waitForSyncOk(page);
  await page.reload();
  await syncA;

  // B repart d'un store vide : il voit la version serveur, désormais celle de A.
  await logoutAndConnect(pageB, 'svi@example.fr');
  await expect(pageB.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await pageB.getByRole('link', { name: feiId }).click();
  const carteBApresSync = pageB.getByRole('button', { name: /Daim.*MM-001-001/ }).first();
  await expect(carteBApresSync.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });

  await contextB.close();
});
