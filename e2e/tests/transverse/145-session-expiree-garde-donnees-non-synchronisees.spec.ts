import { test, expect, type Page } from '../../utils/test';
import type { BrowserContext } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 145 — Session expirée avec des saisies pas encore synchronisées.
// Un 401 avec des données locales non synchronisées ne vide pas le store local : l'app renvoie sur
// /app/connexion. Reconnexion avec le même compte → la saisie est toujours là, puis synchronisée.
// Reconnexion avec un autre compte → la saisie du premier compte est effacée.

const API_URL = 'http://localhost:3291';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

async function keyvalContainsString(page: Page, needle: string): Promise<boolean> {
  return page.evaluate(
    (needleArg) =>
      new Promise<boolean>((resolve) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve(false);
            return;
          }
          const tx = db.transaction('keyval', 'readonly');
          const valuesReq = tx.objectStore('keyval').getAll();
          valuesReq.onsuccess = () => {
            const serialized = JSON.stringify(valuesReq.result);
            db.close();
            resolve(serialized.includes(needleArg));
          };
          valuesReq.onerror = () => {
            db.close();
            resolve(false);
          };
        };
        req.onerror = () => resolve(false);
      }),
    needle
  );
}

// Crée une fiche hors ligne, puis revient en ligne alors que l'API répond 401 à tout : la synchro
// automatique du retour en ligne reçoit le 401 et l'app renvoie sur /app/connexion.
// Retourne le numéro de la fiche jamais synchronisée.
async function createFicheOfflineThenExpireSession(page: Page, context: BrowserContext): Promise<string> {
  // On attend la fin des chargements initiaux avant de passer hors ligne : un GET /user/me coupé par
  // le passage hors ligne repasse l'app « en ligne » (good-connection) et fausserait la suite.
  const pendingApiRequests = new Set<object>();
  page.on('request', (req) => {
    if (req.url().startsWith(API_URL)) pendingApiRequests.add(req);
  });
  page.on('requestfinished', (req) => pendingApiRequests.delete(req));
  page.on('requestfailed', (req) => pendingApiRequests.delete(req));

  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible({ timeout: 10000 });
  await expect.poll(() => pendingApiRequests.size, { timeout: 10000 }).toBe(0);

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  // Session expirée côté serveur : toute requête API reçoit un 401. Les en-têtes CORS sont
  // nécessaires pour que le front lise le statut (app sur :3290, API sur :3291). Les preflight
  // OPTIONS partent au vrai serveur ; aucune requête réelle n'est envoyée, donc rien n'est synchronisé.
  await page.route(`${API_URL}/**`, (route) => {
    if (route.request().method() === 'OPTIONS') return route.continue();
    return route.fulfill({
      status: 401,
      contentType: 'application/json',
      headers: {
        'Access-Control-Allow-Origin': 'http://localhost:3290',
        'Access-Control-Allow-Credentials': 'true',
      },
      body: JSON.stringify({ ok: false, error: 'Unauthorized' }),
    });
  });

  await context.setOffline(false);

  await expect(page).toHaveURL(/\/app\/connexion/, { timeout: 15000 });
  await expect(page.getByRole('textbox', { name: 'Mon email Renseignez votre' })).toBeVisible();
  // La saisie non synchronisée est gardée en local en attendant la reconnexion.
  expect(await keyvalContainsString(page, feiNumero!)).toBe(true);

  await page.unroute(`${API_URL}/**`);
  return feiNumero!;
}

test('Session expirée — reconnexion du même compte : la saisie est gardée puis synchronisée', async ({
  page,
  context,
}) => {
  const feiNumero = await createFicheOfflineThenExpireSession(page, context);

  const syncResponse = page.waitForResponse(
    (res) => res.url() === `${API_URL}/sync` && res.request().method() === 'POST' && res.status() === 200,
    { timeout: 15000 }
  );
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiNumero }).first()).toBeVisible({ timeout: 10000 });

  // Vérification côté serveur : la synchro renvoie la fiche enregistrée. (Une fiche sans carcasse
  // n'est pas redescendue sur un autre appareil — GET /carcasse ne remonte les fiches que via leurs
  // carcasses — on ne peut donc pas la vérifier depuis un second appareil.)
  const syncJson = (await (await syncResponse).json()) as { data: { feis: Array<{ numero: string }> } };
  expect(syncJson.data.feis.map((fei) => fei.numero)).toContain(feiNumero);
});

test("Session expirée — connexion d'un autre compte : la saisie du premier compte est effacée", async ({
  page,
  context,
}) => {
  const feiNumero = await createFicheOfflineThenExpireSession(page, context);

  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await expect(page.getByRole('link', { name: feiNumero })).toHaveCount(0);
  await expect.poll(() => keyvalContainsString(page, feiNumero), { timeout: 10000 }).toBe(false);
});
