import { test, expect, type Page } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 176 — Un lien de création de fiche (`/app/nouvelle-fiche?access_token=…`) connecte le compte
// du jeton. Si un autre compte était connecté sur l'appareil, ses données locales sont vidées : sa fiche
// pas encore synchronisée ne doit ni apparaître chez le compte du jeton, ni partir avec sa session.
// On garde la fiche non synchronisée en bloquant POST /sync (cf. spec 151).

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('LIEN_ACCESS_TOKEN_AUTRE_COMPTE');
});

const isSyncRequest = (url: URL) => url.origin === 'http://localhost:3291' && url.pathname === '/sync';

async function creerAccessToken(email: string) {
  const response = await fetch('http://localhost:3291/v1/access-token/user', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test-private-key-user' },
    body: JSON.stringify({ email }),
  });
  expect(response.ok).toBe(true);
  const json = (await response.json()) as { data: { accessToken: string } };
  return json.data.accessToken;
}

async function idbKeys(page: Page) {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const getKeys = db.transaction('keyval', 'readonly').objectStore('keyval').getAllKeys();
          getKeys.onsuccess = () => {
            resolve(getKeys.result.map(String));
            db.close();
          };
          getKeys.onerror = () => reject(getKeys.error);
        };
      })
  );
}

test("Lien access_token d'un autre compte : la fiche non synchronisée du compte précédent est effacée", async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible({ timeout: 10000 });

  // Le serveur ne reçoit rien : la fiche du compte A reste is_synced = false
  await page.route(isSyncRequest, (route) => route.abort());
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/fei\/ZACH-/);
  const feiIdDuCompteA = new URL(page.url()).pathname.split('/').pop()!;
  await expect.poll(() => idbKeys(page)).toContain(`zs:feis/${feiIdDuCompteA}`);

  const accessToken = await creerAccessToken('examinateur-premier-detenteur@example.fr');
  await page.goto(`http://localhost:3290/app/nouvelle-fiche?access_token=${accessToken}`);
  await expect(page).toHaveURL(/\/app\/chasseur\/fei\/ZACH-/, { timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Informations de chasse' })).toBeVisible({
    timeout: 15000,
  });
  const nouvelleFeiId = new URL(page.url()).pathname.split('/').pop()!;
  expect(nouvelleFeiId).not.toBe(feiIdDuCompteA);
  await expect.poll(() => idbKeys(page)).not.toContain(`zs:feis/${feiIdDuCompteA}`);

  // La synchro reprend avec la session du compte B : seule sa fiche existe
  await page.unroute(isSyncRequest);
  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: nouvelleFeiId })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('link', { name: feiIdDuCompteA })).toHaveCount(0);
});
