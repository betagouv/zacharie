import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Clés idb-keyval (base 'keyval-store', store 'keyval') où le store Zustand persiste ses slices zs:*.
async function getIdbKeys(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve, reject) => {
        const open = indexedDB.open('keyval-store');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve([]);
            return;
          }
          const request = db.transaction('keyval', 'readonly').objectStore('keyval').getAllKeys();
          request.onerror = () => reject(request.error);
          request.onsuccess = () => {
            db.close();
            resolve(request.result.map(String));
          };
        };
      })
  );
}

// Scenario 147 — les carcasses ne sont persistées qu'une fois (pas de copie zs:carcassesRegistry) :
// la liste est dérivée des carcasses. La liste ETG des carcasses doit rester complète après un
// rechargement hors ligne.
test('ETG : la liste des carcasses reste affichée après un rechargement hors ligne', async ({
  page,
  context,
}) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/carcasses');
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-004').first()).toBeVisible();

  // Les carcasses sont écrites dans IndexedDB, sans seconde copie.
  await expect.poll(() => getIdbKeys(page), { timeout: 10000 }).toContain('zs:carcasses');
  expect(await getIdbKeys(page)).not.toContain('zs:carcassesRegistry');

  // Hors ligne côté app : navigator.onLine à false dès le chargement et API injoignable. Le serveur
  // Vite (dev) doit rester joignable pour servir l'app au rechargement, donc pas de context.setOffline.
  await page.addInitScript(() => {
    Object.defineProperty(Navigator.prototype, 'onLine', { get: () => false, configurable: true });
  });
  await context.route('http://localhost:3291/**', (route) => route.abort('internetdisconnected'));

  await page.reload();
  await expect(page).toHaveURL(/\/app\/etg\/carcasses/);
  await expect(page.getByText('MM-001-001').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('MM-001-002').first()).toBeVisible();
  await expect(page.getByText('MM-001-003').first()).toBeVisible();
  await expect(page.getByText('MM-001-004').first()).toBeVisible();

  expect(await getIdbKeys(page)).not.toContain('zs:carcassesRegistry');
});
