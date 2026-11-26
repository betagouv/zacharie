import { test, expect } from '../../utils/test';
import { type Page, type Request } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

const isSyncRequest = (request: Request) =>
  request.url().startsWith('http://localhost:3291/sync') && request.method() === 'POST';

async function clickDeconnexion(page: Page) {
  // en mobile, « Déconnexion » est derrière le bouton « Menu » du header DSFR
  const menuBtn = page.getByRole('button', { name: 'Menu' });
  if (await menuBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await menuBtn.click();
  }
  await page.getByRole('button', { name: 'Déconnexion' }).click();
}

async function createFiche(page: Page) {
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page).toHaveURL(/\/app\/chasseur\/fei\/ZACH-/, { timeout: 10000 });
  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();
  return feiId!;
}

test('Hors ligne, la déconnexion prévient que des modifications ne sont pas envoyées', async ({
  page,
  context,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });

  await context.setOffline(true);
  const feiId = await createFiche(page);

  await clickDeconnexion(page);
  const modal = page.getByRole('dialog', { name: 'Des modifications ne sont pas encore envoyées' });
  await expect(modal).toBeVisible({ timeout: 10000 });
  await modal.getByRole('button', { name: 'Annuler' }).click();
  await expect(modal).toBeHidden();
  await expect(page).toHaveURL(new RegExp(`/app/chasseur/fei/${feiId}`));

  // de retour en ligne, la fiche gardée en local part au serveur
  const feiSynced = page.waitForResponse(
    (resp) => isSyncRequest(resp.request()) && resp.ok() && (resp.request().postData() ?? '').includes(feiId),
    { timeout: 15000 }
  );
  await context.setOffline(false);
  await feiSynced;

  await page.goto('http://localhost:3290/app/chasseur');
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
});

test("En ligne, la déconnexion attend l'envoi des modifications", async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });

  // les /sync restent en attente tant que le test ne les libère pas
  let releaseSync: () => void = () => {};
  const syncGate = new Promise<void>((resolve) => (releaseSync = resolve));
  let logoutClicked = false;
  let markLogoutSyncStarted: () => void = () => {};
  const logoutSyncStarted = new Promise<void>((resolve) => (markLogoutSyncStarted = resolve));
  await page.route('http://localhost:3291/sync', async (route) => {
    if (logoutClicked) markLogoutSyncStarted();
    await syncGate;
    // une requête annulée côté app (nouvelle synchro) ne peut plus être continuée
    await route.continue().catch(() => {});
  });

  const feiId = await createFiche(page);

  logoutClicked = true;
  await clickDeconnexion(page);
  await logoutSyncStarted;
  // l'envoi est en cours : la déconnexion attend
  await expect(page).toHaveURL(new RegExp(`/app/chasseur/fei/${feiId}`));

  releaseSync();
  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 15000 });
  await page.unroute('http://localhost:3291/sync');

  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
});
