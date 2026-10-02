import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 156 — Une fiche sans carcasse, une fois envoyée au serveur, est marquée synchronisée.
// GET /carcasse ne renvoie les fiches qu'à travers leurs carcasses : seule la réponse de /sync
// confirme une fiche vide. Sans ça l'indicateur reste sur « Synchronisation en cours ».

test.use({
  viewport: { width: 350, height: 667 },
  hasTouch: true,
  isMobile: true,
  launchOptions: { slowMo: 100 },
});

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test("Une fiche sans carcasse n'affiche plus « Synchronisation en cours » après la synchro", async ({
  page,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne')).toBeVisible({ timeout: 10000 });

  const syncResponse = page.waitForResponse(
    (res) =>
      res.url().includes('/sync') &&
      res.request().method() === 'POST' &&
      res.status() === 200 &&
      (res.request().postData() ?? '').includes('CHASSENARD'),
    { timeout: 15000 }
  );
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);
  await syncResponse;

  await expect(page.getByText('En ligne')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Synchronisation en cours')).not.toBeVisible();
});
