import { readFileSync } from 'node:fs';
import { read, utils } from '@e965/xlsx';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 141 — Export Excel des fiches : colonne « Nombre d'animaux acceptés » (petit gibier)
test("L'export Excel des fiches contient le nombre d'animaux acceptés par l'ETG", async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-165242';
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await page.getByRole('button', { name: 'Prendre en charge' }).click();
  await expect(page.getByText("Prise en charge par l'atelier")).toBeVisible();

  // Lot de 10 pigeons : l'ETG n'en accepte que 7.
  await new Promise((r) => setTimeout(r, 500)); // react-dsfr modal re-render settle
  const card = page.getByRole('button', { name: /Pigeons.*N° MM-001-003\b/ }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click();
  const dialog = page.getByLabel('Pigeons - N° MM-001-003');
  // exact: le texte d'aide du refus contient aussi « Lot partiellement accepté ».
  await dialog.getByText('Lot partiellement accepté', { exact: true }).click();
  const input = dialog.getByLabel(/Nombre d'animaux acceptés/);
  await input.fill('7');
  await input.blur();
  await dialog.getByRole('button', { name: 'Enregistrer' }).first().click();
  await expect(page.getByText('7 sur 10').first()).toBeVisible();

  // Retour à la liste par la navigation interne : le store local est conservé tel quel.
  await page.getByRole('link', { name: 'Fiches', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.getByText('Table', { exact: true }).click();
  await page.getByRole('checkbox', { name: 'Tout sélectionner' }).check();

  await page.getByRole('button', { name: 'Exporter' }).click();
  const modal = page.getByRole('dialog', { name: 'Exporter les fiches sélectionnées' });
  await expect(modal.getByText("Nombre d'animaux acceptés", { exact: true })).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await modal.getByRole('button', { name: 'Exporter', exact: true }).click();
  const download = await downloadPromise;
  await expect(modal.getByText('Export terminé.')).toBeVisible();

  const workbook = read(readFileSync(await download.path()));
  const rows = utils.sheet_to_json<Record<string, string>>(workbook.Sheets['Carcasses'], { defval: '' });
  const rowOf = (bracelet: string) => rows.find((row) => row['Numéro de marquage'] === bracelet);

  expect(rowOf('MM-001-003')).toMatchObject({
    Éspèce: 'Pigeons',
    "Nombre d'animaux": '10',
    "Nombre d'animaux acceptés": '7',
  });
  // Gros gibier : pas de nombre d'animaux acceptés.
  expect(rowOf('MM-001-001')).toMatchObject({
    Éspèce: 'Daim',
    "Nombre d'animaux acceptés": '',
  });
});
