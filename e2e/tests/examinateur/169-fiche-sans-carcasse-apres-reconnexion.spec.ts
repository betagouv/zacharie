import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Fiche sans carcasse : toujours là après déconnexion / reconnexion', async ({ page }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  // la fiche doit être en base avant la déconnexion, qui vide le store local
  const feiSynced = page.waitForResponse(
    (resp) =>
      resp.url().includes('/sync') &&
      resp.request().method() === 'POST' &&
      resp.ok() &&
      /CHASSENARD/.test(resp.request().postData() ?? ''),
    { timeout: 15000 }
  );
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();
  await feiSynced;

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiId! })).toBeVisible();

  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur', { timeout: 15000 });
  await expect(page.getByRole('link', { name: feiId! })).toBeVisible({ timeout: 10000 });

  await page.getByRole('link', { name: feiId! }).click();
  await expect(page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' })).toHaveValue(
    /CHASSENARD/i
  );
});
