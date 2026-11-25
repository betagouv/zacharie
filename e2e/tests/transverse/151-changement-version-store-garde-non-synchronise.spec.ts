import { test, expect, type Page } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

const isSyncRequest = (url: URL) => url.origin === 'http://localhost:3291' && url.pathname === '/sync';

async function readFromIdb(page: Page, key: string) {
  return page.evaluate(
    (key) =>
      new Promise<unknown>((resolve, reject) => {
        const request = indexedDB.open('keyval-store');
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const get = db.transaction('keyval', 'readonly').objectStore('keyval').get(key);
          get.onsuccess = () => {
            resolve(get.result);
            db.close();
          };
          get.onerror = () => reject(get.error);
        };
      }),
    key
  );
}

test('Changement de version du stockage local : la fiche non synchronisée est gardée puis synchronisée', async ({
  page,
}) => {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('e2e-downgrade-store-version') !== 'pending') return;
    sessionStorage.removeItem('e2e-downgrade-store-version');
    const request = indexedDB.open('keyval-store');
    request.onsuccess = () => {
      const db = request.result;
      const tx = db.transaction('keyval', 'readwrite');
      tx.objectStore('keyval').put({ version: 9 }, 'zs:__meta__');
      tx.oncomplete = () => db.close();
    };
  });

  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible({ timeout: 10000 });

  await page.route(isSyncRequest, (route) => route.abort());

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();
  await expect(page.getByText('Synchronisation en cours')).toBeVisible({ timeout: 10000 });

  await expect
    .poll(async () => {
      const fei = (await readFromIdb(page, `zs:feis/${feiNumero}`)) as { is_synced: boolean } | undefined;
      return fei?.is_synced;
    })
    .toBe(false);
  expect(await readFromIdb(page, 'zs:__meta__')).toEqual({ version: 11 });

  await page.evaluate(() => sessionStorage.setItem('e2e-downgrade-store-version', 'pending'));
  await page.goto('http://localhost:3290/app/chasseur');

  await expect.poll(() => readFromIdb(page, 'zs:__meta__')).toEqual({ version: 11 });

  await expect(page.getByRole('link', { name: feiNumero! }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Synchronisation en cours')).toBeVisible();
  await page.getByRole('link', { name: feiNumero! }).first().click();
  await expect(page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' })).toHaveValue(
    /CHASSENARD/i
  );

  await page.unroute(isSyncRequest);
  let syncedCommune: string | null | undefined;
  await page.route(isSyncRequest, async (route) => {
    const response = await route.fetch();
    if (route.request().method() === 'POST' && response.ok()) {
      const syncJson = (await response.json()) as {
        data: { feis: Array<{ numero: string; commune_mise_a_mort: string | null }> };
      };
      syncedCommune =
        syncJson.data.feis.find((fei) => fei.numero === feiNumero)?.commune_mise_a_mort ?? syncedCommune;
    }
    await route.fulfill({ response });
  });
  await page.goto('http://localhost:3290/app/chasseur');
  await expect.poll(() => syncedCommune, { timeout: 10000 }).toMatch(/CHASSENARD/i);
  await expect(page.getByRole('link', { name: feiNumero! }).first()).toBeVisible();
});
