import { test, expect, type Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 107 — Déconnexion purge le store local-first (IndexedDB).
// Garantit que `clearCache()` est bien appelé au logout : sans ça, les fiches/carcasses
// du user précédent resteraient en cache pour le prochain user (fuite de données).
//
// On ne vérifie PAS via "le user suivant ne voit pas la fiche" : selon les rôles, le
// user suivant peut légitimement avoir accès à la même fiche côté serveur. On vérifie
// directement le contenu d'IndexedDB après logout.

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
});

async function keyvalCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        const req = indexedDB.open('keyval-store');
        req.onsuccess = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains('keyval')) {
            db.close();
            resolve(0);
            return;
          }
          const tx = db.transaction('keyval', 'readonly');
          const countReq = tx.objectStore('keyval').count();
          countReq.onsuccess = () => {
            resolve(countReq.result);
            db.close();
          };
          countReq.onerror = () => {
            db.close();
            resolve(-1);
          };
        };
        req.onerror = () => resolve(-1);
      })
  );
}

test('Déconnexion purge IndexedDB', async ({ page }) => {
  const feiPD = 'ZACH-20250707-QZ6E0-155242';

  // 1. Login peuple le store : la fiche apparaît, donc IndexedDB > 0 entrées.
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiPD })).toBeVisible();
  expect(await keyvalCount(page)).toBeGreaterThan(0);

  // 2. Logout — inline (pas via le helper) pour pouvoir asserter entre logout et re-login.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });

  // 3. L'objet store IndexedDB est vide. clearCache() recrée le store vide après l'avoir purgé.
  expect(await keyvalCount(page)).toBe(0);
});
