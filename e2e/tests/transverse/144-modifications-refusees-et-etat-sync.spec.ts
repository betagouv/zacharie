import { test, expect, type Page } from '../../utils/test';
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

test.beforeEach(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

test.afterEach(async ({ page }) => {
  await page.unrouteAll({ behavior: 'ignoreErrors' });
});

async function creerFiche(page: Page) {
  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await expect(page.getByText('Date de la chasse')).toBeVisible();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await expect(page).toHaveURL(/ZACH-/);
  const feiNumero = RegExp(/ZACH-[A-Z0-9-]+/).exec(page.url())?.[0];
  expect(feiNumero).toBeDefined();
  return feiNumero!;
}

async function refuserLaPremiereFicheEnvoyee(page: Page, reason: string) {
  let feiRefusee: string | null = null;
  let actif = true;
  await page.route('**/sync', async (route) => {
    const response = await route.fetch();
    const payload = route.request().postDataJSON() as { feis?: Array<{ numero: string }> } | null;
    const json = await response.json();
    feiRefusee ??= payload?.feis?.[0]?.numero ?? null;
    const feiEnvoyee = payload?.feis?.some((fei) => fei.numero === feiRefusee);
    if (actif && feiEnvoyee && json.data) {
      json.data.rejected = [...(json.data.rejected ?? []), { kind: 'fei', id: feiRefusee, reason }];
    }
    await route.fulfill({ response, json }).catch((error: Error) => {
      if (!error.message.includes('Route is already handled')) throw error;
    });
  });
  return {
    stop: () => {
      actif = false;
    },
  };
}

test("Une modification refusée par le serveur est signalée à l'utilisateur avec la raison", async ({
  page,
}) => {
  const reason = "Vous n'avez pas accès à cette fiche";
  await refuserLaPremiereFicheEnvoyee(page, reason);

  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await creerFiche(page);

  await expect(page.getByText('1 modification refusée par le serveur')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText("Ces modifications n'ont pas été enregistrées.")).toBeVisible();
  await expect(page.getByText(reason)).toBeVisible();
});

test('Après un refus, une nouvelle modification de la même fiche est envoyée et le refus disparaît', async ({
  page,
}) => {
  const refus = await refuserLaPremiereFicheEnvoyee(page, 'Version obsolète');

  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  const feiNumero = await creerFiche(page);
  await expect(page.getByText('1 modification refusée par le serveur')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible({ timeout: 10000 });
  refus.stop();

  let ficheRenvoyee = false;
  page.on('request', (request) => {
    if (!request.url().includes('/sync') || request.method() !== 'POST') return;
    const payload = request.postDataJSON() as { feis?: Array<{ numero: string }> } | null;
    if (payload?.feis?.some((fei) => fei.numero === feiNumero)) ficheRenvoyee = true;
  });

  const premierDetenteur = page.getByRole('button', { name: 'Pierre Petit' });
  await premierDetenteur.scrollIntoViewIfNeeded();
  await premierDetenteur.click();
  const continuer = page.getByRole('button', { name: 'Continuer' }).first();
  await continuer.scrollIntoViewIfNeeded();
  await continuer.click();

  await expect(async () => {
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    expect(ficheRenvoyee).toBe(true);
  }).toPass({ timeout: 15000 });

  await expect(page.getByText('1 modification refusée par le serveur')).toBeHidden({ timeout: 10000 });
});

test('Après un rechargement, une modification non synchronisée reste signalée comme non synchronisée', async ({
  page,
  context,
}) => {
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');
  await expect(page.getByText('En ligne', { exact: true })).toBeVisible({ timeout: 10000 });

  await context.setOffline(true);
  await creerFiche(page);
  await expect(page.getByText('Synchronisation en cours', { exact: true })).toBeVisible({ timeout: 10000 });

  await page.route('http://localhost:3291/**', (route) => route.abort('internetdisconnected'));
  await context.setOffline(false);
  await page.reload();

  await expect(page.getByText('Synchronisation en cours', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('En ligne', { exact: true })).not.toBeVisible();
});
