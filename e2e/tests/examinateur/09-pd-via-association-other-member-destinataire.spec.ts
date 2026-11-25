import { test, expect } from '../../utils/test';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import utc from 'dayjs/plugin/utc';
dayjs.extend(utc);
dayjs.locale('fr');
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { dateApprobationDuJour } from '../../utils/date-approbation';
import {
  openVenteDon,
  allerAEtape,
  choisirRepartition,
  choisirStockage,
  choisirTransport,
  enregistrerVenteDon,
  selectDestinataire,
  venteDonModal,
} from '../../utils/vente-don';
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

test("Autre membre de l'Association voit le bloc Vente / don sur la fiche", async ({ page }) => {
  await connectWith(page, 'examinateur-premier-detenteur@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/chasseur');

  await page.getByRole('button', { name: 'Nouvelle fiche' }).first().click();
  await page.getByRole('button', { name: dayjs.utc().format('dddd DD MMMM') }).click();
  await page.getByRole('textbox', { name: 'Commune de prélèvement du gibier' }).fill('CHASS');
  await page.getByRole('button', { name: 'CHASSENARD' }).click();

  await page.getByRole('button', { name: /Association de chasseurs/i }).click();
  await page.getByRole('button', { name: 'Continuer' }).first().click();

  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Daim');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
  await page.getByRole('button', { name: 'Ajouter une carcasse' }).click();
  await page.getByLabel('Espèce (grand et petit gibier)').selectOption('Cerf élaphe');
  await page.getByRole('button', { name: /^PP-\d{3}-\d{3}$/ }).click();
  await page.getByRole('button', { name: 'Ajouter la carcasse' }).click();
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
  await page
    .getByText(/Je, .* certifie qu/i)
    .first()
    .click();

  const feiNumero = page.url().match(/ZACH-[A-Z0-9-]+/)?.[0];
  expect(feiNumero).toBeDefined();

  await page.getByRole('button', { name: 'Transmettre', exact: true }).click();

  await openVenteDon(page);
  await selectDestinataire(page, 'ETG 1 - 75000 Paris');

  await allerAEtape(page, 'Carcasses');
  await choisirRepartition(page, 'partie');
  const cerfToggle = venteDonModal(page).getByRole('button', { name: /^Retirer Cerf/ });
  await cerfToggle.scrollIntoViewIfNeeded();
  await cerfToggle.click();

  await allerAEtape(page, 'Stockage');
  await choisirStockage(page, 'aucun');
  await allerAEtape(page, 'Transport');
  await choisirTransport(page, 'moi');
  await enregistrerVenteDon(page);

  const transmettre = page.getByRole('button', { name: 'Transmettre', exact: true });
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();
  await expect(page.getByText(/ETG 1 a été notifié/i)).toBeVisible({ timeout: 10000 });

  await logoutAndConnect(page, 'premier-detenteur@example.fr');

  await page.goto(`http://localhost:3290/app/chasseur/fei/${feiNumero}`);

  await expect(page.getByRole('heading', { name: 'Destinataires' })).toBeVisible({ timeout: 15000 });
});
