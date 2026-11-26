import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

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

  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiPD })).toBeVisible();
  expect(await keyvalContainsString(page, feiPD)).toBe(true);

  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('button', { name: 'Déconnexion' }).click();
  await page.waitForURL(/\/app\/connexion/, { timeout: 15000 });

  expect(await keyvalContainsString(page, feiPD)).toBe(false);
});
