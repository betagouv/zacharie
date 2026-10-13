import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 153 — Un utilisateur connecté qui ouvre la page de création de compte ou d'invitation
// (ex. lien d'un email) est renvoyé vers son tableau de bord après un nettoyage du stockage local.
// Après un rechargement, ses fiches doivent toujours être listées : le store zustand doit être
// remis à zéro avec le stockage, sinon le curseur de synchro est réécrit sans les fiches.

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeEach(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

const feiId = 'ZACH-20250707-QZ6E0-155242';

for (const route of ['creation-de-compte', 'invitation']) {
  test(`Connecté, passage par /app/connexion/${route} puis rechargement : les fiches restent listées`, async ({
    page,
  }) => {
    await connectWith(page, 'premier-detenteur@example.fr');
    await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });

    await page.goto(`http://localhost:3290/app/connexion/${route}`);
    // Utilisateur déjà connecté : redirection vers son tableau de bord
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });

    // Le chargement des données a réécrit le curseur de synchro dans IndexedDB
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            new Promise<unknown>((resolve, reject) => {
              const request = indexedDB.open('keyval-store');
              request.onerror = () => reject(request.error);
              request.onsuccess = () => {
                const db = request.result;
                const get = db
                  .transaction('keyval', 'readonly')
                  .objectStore('keyval')
                  .get('zs:lastUpdateFromServer');
                get.onsuccess = () => {
                  resolve(get.result);
                  db.close();
                };
                get.onerror = () => reject(get.error);
              };
            })
        )
      )
      .toBeTruthy();

    await page.reload();
    await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
    await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  });
}
