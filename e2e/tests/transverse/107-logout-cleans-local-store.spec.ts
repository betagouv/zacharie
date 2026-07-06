import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 107 — Déconnexion purge le contenu du store local-first (IndexedDB).
// Garantit que `clearCache()` est bien appelé au logout : sans ça, les fiches/carcasses
// du user précédent resteraient en cache pour le prochain user (fuite de données).
//
// On ne vérifie PAS qu'IndexedDB a 0 entrées : après le reset du store Zustand,
// la persist middleware réécrit chaque slice avec sa valeur initialState (objets/arrays
// vides). C'est OK — pas de données de session — mais ça fait ~12 entrées présentes.
// On vérifie donc que AUCUNE valeur dans IndexedDB ne contient une référence à la
// fiche du user précédent.
//
// On ne vérifie pas non plus via "le user suivant ne voit pas la fiche" : selon les
// rôles, le user suivant peut légitimement avoir accès à la même fiche côté serveur.

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
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

test('Déconnexion purge IndexedDB', async ({ page }) => {
  const feiPD = 'ZACH-20250707-QZ6E0-155242';

  // 1. Login peuple le store : la fiche apparaît, donc IndexedDB contient son numéro.
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiPD })).toBeVisible();
  expect(await keyvalContainsString(page, feiPD)).toBe(true);

  // 2. Logout — inline (pas via le helper) pour pouvoir asserter entre logout et re-login.
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });

  // 3. Le numéro de fiche du user précédent ne doit plus apparaître dans IndexedDB.
  expect(await keyvalContainsString(page, feiPD)).toBe(false);
});
