import { test, expect, type Page } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 149 — Les détenteurs initiaux chargés par load-my-relations survivent à un rechargement
// hors ligne. L'examinateur (examinateur@example.fr) a une relation PREMIER_DETENTEUR vers
// Pierre Petit (premier-detenteur@example.fr, id 0Y545) dans le seed : Pierre n'est connu du store
// que par user/my-relations. Après rechargement, user/my-relations est coupé puis le réseau aussi :
// Pierre doit encore être proposé comme propriétaire initial, donc lu depuis IndexedDB.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

const PIERRE_PETIT_ID = '0Y545';

async function persistedDetenteursInitiauxIds(page: Page): Promise<string[]> {
  return page.evaluate(
    () =>
      new Promise<string[]>((resolve) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve([]);
            return;
          }
          const tx = db.transaction('keyval', 'readonly');
          const valueReq = tx.objectStore('keyval').get('zs:detenteursInitiauxIds');
          valueReq.onsuccess = () => {
            db.close();
            resolve(Array.isArray(valueReq.result) ? valueReq.result : []);
          };
          valueReq.onerror = () => {
            db.close();
            resolve([]);
          };
        };
        req.onerror = () => resolve([]);
      })
  );
}

test('Les détenteurs initiaux restent proposés après un rechargement hors ligne', async ({
  page,
  context,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  // Les relations sont chargées et écrites dans IndexedDB (même écriture que la tranche `users`).
  await expect
    .poll(() => persistedDetenteursInitiauxIds(page), { timeout: 15000 })
    .toContain(PIERRE_PETIT_ID);

  // Au rechargement, user/my-relations ne répond plus : Pierre ne peut venir que du stockage local.
  await page.route(/\/user\/my-relations/, (route) => route.abort('internetdisconnected'));
  await page.reload();
  await expect(page.getByRole('button', { name: 'Nouvelle fiche' }).first()).toBeVisible({
    timeout: 15000,
  });

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);

  const pierrePetit = page.getByRole('button', { name: 'Pierre Petit' });
  await pierrePetit.scrollIntoViewIfNeeded();
  await expect(pierrePetit).toBeVisible({ timeout: 10000 });

  await context.setOffline(false);
});
