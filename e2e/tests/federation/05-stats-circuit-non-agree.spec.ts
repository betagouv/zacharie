import { test, expect } from '../../utils/test';
import type { Locator } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Seed FEDERATION_STATS_CIRCUIT_COURT — une seule fiche de la saison en cours, dans l'Allier (03),
// transmise par le premier détenteur à un commerce de détail : 3 carcasses grand gibier + 1 lot de
// 10 pigeons. Le commerce de détail ne prend jamais en charge dans Zacharie.
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
    '1', // examinateurs actifs
    '0', // GG agréé
    '3', // GG non agréé
    '0', // GG domestique
    '3', // GG total
    '—', // GG taux de saisie : pas d'inspection SVI en circuit court
    '0', // PG agréé (animaux)
    '10', // PG non agréé (animaux)
    '0', // PG domestique (animaux)
    '10', // PG total (animaux)
    'Accéder au tableau de bord',
  ]);
});
