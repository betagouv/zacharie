import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

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

  await page.evaluate(() =>
    navigator.serviceWorker.register('/dev-sw.js?dev-sw', { type: 'module', scope: '/' })
  );
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 15000,
  });

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

  await expect
    .poll(
      async () => (await listCachedUrls()).filter((url) => url.startsWith('http://localhost:3290')).length
    )
    .toBeGreaterThan(0);

  const apiUrls = (await listCachedUrls()).filter((url) => url.startsWith(API_ORIGIN));
  expect(apiUrls).toEqual([]);

  await page.reload();
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 15000 });
  expect((await listCachedUrls()).filter((url) => url.startsWith(API_ORIGIN))).toEqual([]);
});
