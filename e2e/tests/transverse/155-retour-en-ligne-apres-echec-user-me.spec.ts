import { test, expect } from '../../utils/test';
import type { Route } from '@playwright/test';
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
  serviceWorkers: 'block',
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test("Un échec de /user/me pendant la coupure n'empêche pas la synchro au retour en ligne", async ({
  page,
  context,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne')).toBeVisible({ timeout: 10000 });

  const pendingUserMe: Route[] = [];
  let userMeRequested: () => void;
  const userMeRequestedPromise = new Promise<void>((resolve) => {
    userMeRequested = resolve;
  });
  await page.route('**/user/me', (route) => {
    pendingUserMe.push(route);
    userMeRequested();
  });

  await page.reload();
  await userMeRequestedPromise;

  await context.setOffline(true);
  await expect(page.getByText('Hors ligne')).toBeVisible({ timeout: 10000 });
  for (const route of pendingUserMe) {
    await route.abort('internetdisconnected');
  }
  await page.unroute('**/user/me');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);
  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  const syncResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/sync') &&
      res.request().method() === 'POST' &&
      res.status() === 200 &&
      (res.request().postData() ?? '').includes(feiNumero!),
    { timeout: 15000 }
  );
  await context.setOffline(false);
  await syncResponse;
});
