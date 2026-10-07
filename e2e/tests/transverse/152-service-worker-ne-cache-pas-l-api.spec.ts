import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 152 — Le service worker ne met jamais en cache les réponses de l'API (autre origine,
// http://localhost:3291 en e2e) : seuls les fichiers de l'app (même origine) sont cachés.
// Le reload hors-ligne n'est pas testable ici (Vite dev, cf. spec 106 skippée).

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('PREMIER_DETENTEUR');
});

const API_ORIGIN = 'http://localhost:3291';

test("Service worker : aucune réponse de l'API dans le cache", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-155242';
  await connectWith(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 10000 });
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });

  // En dev, l'app enregistre /src/service-worker.ts, dont la portée est /src/ : il ne contrôle jamais
  // les pages /app/*. vite-plugin-pwa sert le même fichier à la racine (/dev-sw.js?dev-sw) : on
  // l'enregistre avec la portée / pour que le service worker contrôle la page, comme en production.
  await page.evaluate(() =>
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { type: 'module', scope: '/' })
  );
  // Le service worker contrôle la page (clients.claim à l'activation)
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 15000,
  });

  // Rechargement : toutes les requêtes de la page passent désormais par le service worker,
  // y compris les GET vers l'API (chargement des fiches)
  const apiGetResponse = page.waitForResponse(
    (res) => res.url().startsWith(API_ORIGIN) && res.request().method() === 'GET' && res.ok()
  );
  await page.reload();
  await apiGetResponse;
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });

  const listCachedUrls = () =>
    page.evaluate(async () => {
      const urls: string[] = [];
      for (const cacheName of await caches.keys()) {
        const cache = await caches.open(cacheName);
        for (const request of await cache.keys()) urls.push(request.url);
      }
      return urls;
    });

  // Le service worker cache bien les fichiers de l'app...
  await expect
    .poll(
      async () => (await listCachedUrls()).filter((url) => url.startsWith('http://localhost:3290')).length
    )
    .toBeGreaterThan(0);

  // ... mais aucune réponse de l'API
  const apiUrls = (await listCachedUrls()).filter((url) => url.startsWith(API_ORIGIN));
  expect(apiUrls).toEqual([]);

  // L'app reste utilisable après un nouveau rechargement en ligne
  await page.reload();
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  expect((await listCachedUrls()).filter((url) => url.startsWith(API_ORIGIN))).toEqual([]);
});
