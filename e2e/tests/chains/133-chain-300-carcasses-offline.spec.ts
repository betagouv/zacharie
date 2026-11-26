import { test, expect, type Page, type Response } from '@playwright/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { ajouterVenteDon } from '../../utils/vente-don';
import { dateApprobationDuJour } from '../../utils/date-approbation';
import { logoutAndConnect } from '../../utils/logout-and-connect';

const DAIM_COUNT = 45;
const CHEV_COUNT = 45;
const PIGEON_LOTS = [5, 8, 10, 12, 7, 9, 15, 6, 20, 11].slice(0, 10);
const pad = (n: number) => String(n).padStart(3, '0');

test.use({ trace: 'off' });

test.setTimeout(Number((DAIM_COUNT + CHEV_COUNT + PIGEON_LOTS.length) * 3000 + 180000));

test.beforeAll(async () => {
  await resetDb('EXAMINATEUR_INITIAL');
});

async function addCarcasse(
  page: Page,
  opts: { espece: string; bracelet: string; first?: boolean; lot?: number }
) {
  const now = Date.now();
  const openModal = page.getByRole('button', { name: 'Ajouter une carcasse' });
  await openModal.scrollIntoViewIfNeeded();
  await openModal.click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption(opts.espece);
  if (opts.lot) {
    const quantite = page.getByLabel(/Nombre de carcasses dans le lot/);
    await quantite.scrollIntoViewIfNeeded();
    await quantite.fill(String(opts.lot));
    await quantite.blur();
  }
  const bracelet = page.getByRole('textbox', { name: /Numéro de marquage/ });
  await bracelet.scrollIntoViewIfNeeded();
  await bracelet.fill(opts.bracelet);
  await bracelet.blur();
  const submit = page.getByRole('button', {
    name: opts.lot ? 'Ajouter le lot de carcasses' : 'Ajouter la carcasse',
  });
  await submit.scrollIntoViewIfNeeded();
  await submit.click();
  console.log(`addCarcasse ${opts.espece} ${opts.bracelet} took ${Date.now() - now}ms`);
}

function carcasseCard(page: Page, espece: string, bracelet: string) {
  return page.getByRole('button', { name: new RegExp(`${espece}.*N° ${bracelet}\\b`) }).first();
}
function carcasseDialog(page: Page, espece: string, bracelet: string) {
  return page.getByLabel(`${espece} - N° ${bracelet}`);
}

async function markManquante(page: Page, espece: string, bracelet: string) {
  const card = carcasseCard(page, espece, bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  await carcasseDialog(page, espece, bracelet).getByText('Carcasse manquante').click();
  await expect(card).toBeVisible();
}

async function markRefusee(page: Page, espece: string, bracelet: string, motif = 'Présence de souillures') {
  const card = carcasseCard(page, espece, bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = carcasseDialog(page, espece, bracelet);
  await dialog.getByText('Carcasse refusée').click();
  await dialog.locator('.input-for-search-prefilled-data__input-container').click();
  await page.getByRole('option', { name: motif }).click();
  const save = dialog.getByRole('button', { name: /Enregistrer|Refuser/ }).first();
  await save.scrollIntoViewIfNeeded();
  await save.click();
  await expect(card).toBeVisible();
}

async function markLotPartiel(page: Page, bracelet: string, accepted: number) {
  const card = carcasseCard(page, 'Pigeons', bracelet);
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = carcasseDialog(page, 'Pigeons', bracelet);
  await dialog.getByText('Lot partiellement accepté', { exact: true }).click();
  const input = dialog.getByLabel(/Nombre d'animaux acceptés/);
  await input.fill(String(accepted));
  await input.blur();
  await dialog.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(card).toBeVisible();
}

test('Chaîne 300 carcasses : examinateur → PD → collecteur → ETG → SVI (collecteur & ETG hors-ligne)', async ({
  page,
  context,
}) => {
  await page.setViewportSize({ width: 350, height: 667 });
  await connectWith(page, 'examinateur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();
  await page.getByRole('button', { name: 'Pierre Petit' }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await context.setOffline(true);
  for (let i = 1; i <= DAIM_COUNT; i++) {
    await addCarcasse(page, { espece: 'Daim', bracelet: `DAIM-${pad(i)}`, first: i === 1 });
  }
  for (let i = 1; i <= CHEV_COUNT; i++) {
    await addCarcasse(page, { espece: 'Chevreuil', bracelet: `CHEV-${pad(i)}` });
  }
  for (let i = 0; i < PIGEON_LOTS.length; i++) {
    await addCarcasse(page, { espece: 'Pigeons', bracelet: `PIG-${pad(i + 1)}`, lot: PIGEON_LOTS[i] });
  }

  await page.getByRole('button', { name: 'Continuer' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Continuer' }).click();

  await page
    .getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' })
    .fill(dayjs().startOf('day').add(1, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure du prélèvement de la première carcasse' }).blur();
  await page
    .getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' })
    .fill(dayjs().startOf('day').add(2, 'hour').format('HH:mm'));
  await page.getByRole('textbox', { name: 'Heure d’éviscération de la dernière carcasse' }).blur();

  await page.getByRole('button', { name: dateApprobationDuJour() }).click();
  await page.getByText('Je, Martin Marie, certifie qu').click();

  const isSyncPost = (r: Response) =>
    new URL(r.url()).pathname === '/sync' && r.request().method() === 'POST' && r.ok();
  const isCarcasseDelta = (r: Response) => new URL(r.url()).pathname === '/carcasse' && r.ok();
  const reconnectSync = page.waitForResponse(isSyncPost, { timeout: 120000 });
  const reconnectDelta = page.waitForResponse(isCarcasseDelta, { timeout: 120000 });
  await context.setOffline(false);
  await reconnectSync;
  await reconnectDelta;

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await expect(transmettre).not.toBeDisabled();
  const transmissionUploaded = page.waitForResponse(isSyncPost, { timeout: 120000 });
  await transmettre.click();
  await expect(page.getByText(/Votre fiche a été transmise/i).first()).toBeVisible({ timeout: 60000 });
  await transmissionUploaded;

  const feiId = RegExp(/ZACH-\d+-\w+-\d+/).exec(page.url())?.[0];
  expect(feiId).toBeDefined();

  await page.goto('http://localhost:3290/app/chasseur');
  await logoutAndConnect(page, 'premier-detenteur@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/, { timeout: 15000 });
  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiId}`);
  await ajouterVenteDon(page, { destinataire: /Collecteur Pro 1/i });
  const transmettrePd = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettrePd.scrollIntoViewIfNeeded();
  await transmettrePd.click();
  await expect(page.getByText(/Collecteur Pro 1 a été notifié/).first()).toBeVisible({ timeout: 60000 });

  await page.setViewportSize({ width: 1280, height: 900 });
  await logoutAndConnect(page, 'collecteur-pro@example.fr');
  await expect(page).toHaveURL(/\/app\/collecteur/);
  await page.getByRole('link', { name: feiId }).click();
  const priseEnChargeColl = page.getByRole('button', { name: /Je contrôle et transporte les carcasses/ });
  await priseEnChargeColl.click();
  await expect(priseEnChargeColl).toBeHidden({ timeout: 15000 });

  await context.setOffline(true);

  await markManquante(page, 'Daim', 'DAIM-001');
  await markRefusee(page, 'Chevreuil', 'CHEV-001');

  await page.getByRole('button', { name: /Cliquez ici pour définir/ }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /ETG 1/ }).click();
  const pasDeStockageColl = page.getByText(/Pas de stockage/i).first();
  await pasDeStockageColl.scrollIntoViewIfNeeded();
  await pasDeStockageColl.click();
  const transmettreColl = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreColl.scrollIntoViewIfNeeded();
  await transmettreColl.click();

  await context.setOffline(false);
  await expect(page.getByText(/ETG 1 a été notifié/)).toBeVisible({ timeout: 60000 });

  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  const priseEnChargeEtg = page.getByRole('button', { name: 'Prendre en charge' });
  await priseEnChargeEtg.click();
  await expect(priseEnChargeEtg).toBeHidden({ timeout: 15000 });

  await context.setOffline(true);

  await markManquante(page, 'Daim', 'DAIM-002');
  await markRefusee(page, 'Chevreuil', 'CHEV-002');
  await markLotPartiel(page, 'PIG-001', Math.max(1, PIGEON_LOTS[0] - 2));

  await page.getByRole('button', { name: 'Cliquez ici pour définir' }).click();
  await page.locator("[class*='select-prochain-detenteur'][class*='input-container']").click();
  await page.getByRole('option', { name: /SVI 1/ }).click();
  const transmettreEtg = page.getByRole('button', { name: 'Transmettre la fiche' });
  await transmettreEtg.scrollIntoViewIfNeeded();
  await transmettreEtg.click();

  const etgTransmissionSynced = page.waitForResponse(
    (r) => new URL(r.url()).pathname === '/sync' && r.request().method() === 'POST' && r.ok(),
    { timeout: 120000 }
  );
  await context.setOffline(false);
  await etgTransmissionSynced;

  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 60000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByText(/carcasses déjà refusées \(4\)/i)).toBeVisible({ timeout: 15000 });
});
