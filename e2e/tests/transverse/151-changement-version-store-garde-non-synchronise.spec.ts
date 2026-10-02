import { test, expect, type Page } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 151 — Une mise à jour de l'app (bump de `version` du store zustand persisté) ne fait pas
// perdre les saisies pas encore synchronisées.
// Le reload hors-ligne n'est pas possible en e2e (Vite dev, pas de precache, cf. spec 106) : on garde
// la fiche non synchronisée en bloquant POST /sync, puis on simule une ancienne version de stockage
// en réécrivant la méta du stockage IndexedDB (idb-keyval : base 'keyval-store', store 'keyval',
// clé 'zs:__meta__', cf. src/zustand/idb-sliced-storage.ts).

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
  // Au prochain chargement de page, réécrit la version stockée avant que l'app ne lise le stockage.
  // La transaction est ouverte avant celle d'idb-keyval (init script exécuté avant le code de l'app),
  // donc l'app lit forcément la version 9. Déclenché une seule fois via un flag sessionStorage.
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

  // Le serveur ne reçoit rien : la fiche reste is_synced = false
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

  // La fiche non synchronisée est bien écrite dans IndexedDB avant le reload
  await expect
    .poll(async () => {
      const feis = (await readFromIdb(page, 'zs:feis')) as Record<string, { is_synced: boolean }> | undefined;
      return feis?.[feiNumero!]?.is_synced;
    })
    .toBe(false);
  expect(await readFromIdb(page, 'zs:__meta__')).toEqual({ version: 10 });

  // Reload avec une version stockée plus ancienne : le `migrate` du store s'exécute
  await page.evaluate(() => sessionStorage.setItem('e2e-downgrade-store-version', 'pending'));
  await page.goto('http://localhost:3290/app/chasseur');

  // Le migrate a tourné et réécrit la version courante
  await expect.poll(() => readFromIdb(page, 'zs:__meta__')).toEqual({ version: 10 });

  // La fiche (jamais arrivée au serveur) est toujours là, avec sa saisie
  await expect(page.getByRole('link', { name: feiNumero! }).first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('Synchronisation en cours')).toBeVisible();
  await page.getByRole('link', { name: feiNumero! }).first().click();
  await expect(page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' })).toHaveValue(
    /CHASSENARD/i
  );

  // Retour du serveur : la fiche se synchronise
  await page.unroute(isSyncRequest);
  const syncResponse = page.waitForResponse(
    (res) => isSyncRequest(new URL(res.url())) && res.request().method() === 'POST' && res.ok()
  );
  await page.goto('http://localhost:3290/app/chasseur');
  // Le serveur a enregistré la fiche avec sa saisie. (On ne vérifie pas l'indicateur « En ligne » :
  // une fiche sans carcasse ne redescend pas dans le delta de GET /carcasse, donc reste
  // is_synced = false côté app même après une synchro réussie.)
  const syncJson = (await (await syncResponse).json()) as {
    data: { feis: Array<{ numero: string; commune_mise_a_mort: string | null }> };
  };
  expect(syncJson.data.feis.find((fei) => fei.numero === feiNumero)?.commune_mise_a_mort).toMatch(
    /CHASSENARD/i
  );
  await expect(page.getByRole('link', { name: feiNumero! }).first()).toBeVisible();
});
