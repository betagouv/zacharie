import { test, expect } from '../../utils/test';
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
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test('Création hors-ligne puis sync auto au retour en ligne', async ({ page, context }) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await context.setOffline(true);

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();

  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();

  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  await expect(page).toHaveURL(/ZACH-/);

  const ficheUrl = page.url();
  const feiNumero = ficheUrl.match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await context.setOffline(false);

  await page.goto('http://localhost:3290/app/chasseur');
  await expect(page.getByRole('link', { name: feiNumero! }).first()).toBeVisible({ timeout: 15000 });
});
