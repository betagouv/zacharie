import { test, expect } from '../../utils/test';
import type { Locator } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('FEDERATION_STATS_CIRCUIT_COURT');
});

async function rowCells(row: Locator) {
  return row.getByRole('cell').allTextContents();
}

test('FNC — les carcasses transmises à un commerce de détail comptent en circuit non agréé', async ({
  page,
}) => {
  await connectWith(page, 'fnc@example.fr');
  await expect(page).toHaveURL(/\/app\/federation\/tableau-de-bord/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord national' })).toBeVisible({
    timeout: 15000,
  });

  const allier = page.getByRole('row').filter({ hasText: 'Allier' });
  await expect(allier).toHaveCount(1);
  expect(await rowCells(allier)).toEqual([
    '03 Allier',
    '1',
    '0',
    '3',
    '0',
    '3',
    '—',
    '0',
    '10',
    '0',
    '10',
    'Accéder au tableau de bord',
  ]);
});
