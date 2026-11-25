import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TABLEAU_DE_BORD');
});

test('Le tableau de bord ETG compte les animaux des lots de petit gibier', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/tableau-de-bord');

  const statCard = (label: string, exact = false) =>
    page.locator('div.rounded-lg').filter({ has: page.getByText(label, { exact }) });

  await expect(statCard('Animaux réceptionnés')).toContainText('13', { timeout: 10000 });
  await expect(statCard('Grand gibier', true)).toContainText('3');
  await expect(statCard('Petit gibier', true)).toContainText('10');

  await expect(statCard('Taux de refus')).toContainText('23,1 %');
  await expect(statCard('Taux de refus')).toContainText('3 refusées');

  await expect(statCard('Taux de saisie (totales + partielles)')).toContainText('30 %');
  await expect(statCard('Taux de saisie (totales + partielles)')).toContainText('3 sur 10 inspectées');

  await expect(statCard('Score de qualité du tri à réception')).toContainText('90 / 100');

  await expect(statCard('Score BPH moyen des apporteurs')).toContainText('0 / 100');
});
