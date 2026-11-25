import { readFileSync } from 'node:fs';
import { read, utils } from '@e965/xlsx';
import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('SVI_CLOSED');
});

test('91 - Le SVI exporte le bilan de saison, une ligne par ETG et par espèce', async ({ page }) => {
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);
  await page.getByRole('link', { name: 'Carcasses', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/svi\/carcasses/);

  const menuButton = page.getByRole('button', { name: 'Bilan de saison' });
  await menuButton.scrollIntoViewIfNeeded();
  await menuButton.click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel Juin 2025 - Mai 2026' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('Zacharie - Bilan des anomalies - saison 2025-2026.xlsx');

  const workbook = read(readFileSync(await download.path()));
  expect(workbook.SheetNames).toEqual([
    'I - Données générales',
    'II - Examen initial',
    'III - Anomalies carcasses',
  ]);

  const rows = utils.sheet_to_json<Record<string, string | number>>(
    workbook.Sheets['I - Données générales'],
    {
      defval: '',
    }
  );
  expect(rows).toHaveLength(7);
  const rowOf = (espece: string) => rows.find((row) => row['Espèce'] === espece);

  expect(rowOf('Daim')).toMatchObject({
    ETG: 'ETG 1',
    Département: '75',
    'Nbre de carcasses réceptionnées': 3,
    'Nbre de carcasses contrôlées': 3,
    'Nbre de saisies partielles': 0,
    'Nbre de saisies totales': 0,
  });
  expect(rowOf('Petit gibier à plumes')).toMatchObject({
    'Nbre de carcasses réceptionnées': 10,
    'Nbre de carcasses contrôlées': 10,
  });
  expect(rowOf('Sanglier')).toMatchObject({ 'Nbre de carcasses réceptionnées': 0 });
});
