import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TABLEAU_DE_BORD');
});

// Scenario 166 — Tableau de bord ETG : un lot de petit gibier compte pour son nombre d'animaux.
// Seed : 3 daims (1 refusé, 1 saisi pour balle d'abdomen, 1 accepté) + 1 lot de 10 pigeons
// (8 acceptés par l'ETG, 2 saisis par le SVI).
test('Le tableau de bord ETG compte les animaux des lots de petit gibier', async ({ page }) => {
  await connectWith(page, 'etg-1@example.fr');
  await expect(page).toHaveURL('http://localhost:3290/app/etg');
  await page.goto('http://localhost:3290/app/etg/tableau-de-bord');

  const statCard = (label: string, exact = false) =>
    page.locator('div.rounded-lg').filter({ has: page.getByText(label, { exact }) });

  // 3 daims + 10 pigeons (et non 4 carcasses/lots)
  await expect(statCard('Animaux réceptionnés')).toContainText('13', { timeout: 10000 });
  await expect(statCard('Grand gibier', true)).toContainText('3');
  await expect(statCard('Petit gibier', true)).toContainText('10');

  // 1 daim + 2 pigeons refusés sur 13 animaux
  await expect(statCard('Taux de refus')).toContainText('23,1 %');
  await expect(statCard('Taux de refus')).toContainText('3 refusées');

  // 10 animaux inspectés (2 daims + 8 pigeons), 3 saisis (1 daim + 2 pigeons)
  await expect(statCard('Taux de saisie (totales + partielles)')).toContainText('30 %');
  await expect(statCard('Taux de saisie (totales + partielles)')).toContainText('3 sur 10 inspectées');

  // 1 saisie pour balle d'abdomen sur 10 animaux inspectés
  await expect(statCard('Score de qualité du tri à réception')).toContainText('90 / 100');

  // Un seul apporteur : 1 saisie BPH sur 2 daims inspectés, bien au-delà du taux national
  await expect(statCard('Score BPH moyen des apporteurs')).toContainText('0 / 100');
});
