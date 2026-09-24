import { test, expect } from '../../utils/test';
import type { Locator, Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Les specs 01 et 02 vérifient que les sections s'affichent. Celle-ci vérifie les chiffres,
// et donc l'exclusion des comptes admin Zacharie des statistiques fédérations.
//
// Seed FEDERATION_STATS — trois fiches de la saison en cours, toutes prises en charge par
// l'ETG (circuit agréé), chacune avec 3 carcasses grand gibier + 1 lot de 10 pigeons :
//   - Allier (03), examinateur Marie Martin, 1 carcasse GG saisie
//   - Ardèche (07), examinateur Marie Martin, aucune saisie
//   - Allier (03), examinateur = compte admin Zacharie → EXCLUE des statistiques
// Toutes les autres fixtures du seed sont datées du 07/07/2025, hors saison en cours : elles
// n'apparaissent jamais dans ces tableaux de bord.
test.beforeAll(async () => {
  await resetDb('FEDERATION_STATS');
});

function section(page: Page, heading: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: heading }) });
}

// Les tuiles KPI sont des div sans rôle : la valeur est la div qui suit le libellé.
function kpi(root: Locator, label: string | RegExp) {
  const text = typeof label === 'string' ? root.getByText(label, { exact: true }) : root.getByText(label);
  return text.locator('xpath=following-sibling::div[1]');
}

// « Anomalies signalées » est à la fois un libellé de tuile et un titre de camembert :
// on part du sous-titre, qui lui est unique.
function kpiFromSublabel(root: Locator, sublabel: string) {
  return root.getByText(sublabel, { exact: true }).locator('xpath=preceding-sibling::div[1]');
}

async function rowCells(row: Locator) {
  return row.getByRole('cell').allTextContents();
}

async function openTableauDeBordFederation(page: Page, email: string) {
  await connectWith(page, email);
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.getByRole('link', { name: 'Tableau de bord Fédération' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord-federation/);
}

test('FNC — chiffres nationaux, fiches du compte admin exclues', async ({ page }) => {
  await connectWith(page, 'fnc@example.fr');
  await expect(page).toHaveURL(/\/app\/federation\/tableau-de-bord/);

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord national' })).toBeVisible({
    timeout: 15000,
  });
  await expect(page.getByText(/^Saison \d{2}-\d{2}$/)).toBeVisible();

  // Allier + Ardèche, sans la fiche admin : 2 × 3 carcasses GG et 2 × 10 animaux de petit gibier.
  const prelevees = section(page, 'Carcasses prélevées');
  await expect(kpi(prelevees, 'Grand gibier')).toHaveText('6');
  await expect(kpi(prelevees, 'Petit gibier')).toHaveText('20');

  // La fiche admin porte 3 saisies GG de plus : sans l'exclusion le taux de saisie serait
  // de 44,4 % (4/9) au lieu de 16,7 % (1/6), et les anomalies passeraient de 4 à 6.
  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpi(sanitaire, 'Examinateurs actifs')).toHaveText('2');
  await expect(kpiFromSublabel(sanitaire, "Anomalies signalées lors de l'examen initial")).toHaveText('4');
  await expect(kpi(sanitaire, /^Taux de saisie saison \d{2}-\d{2}$/)).toHaveText('16.7%');
  await expect(kpi(sanitaire, 'Taux de saisie national 25-26')).toHaveText('23.9%');

  // Le filtre par département n'est proposé qu'au périmètre national.
  await expect(page.getByPlaceholder('Filtrer par département')).toBeVisible();

  const allier = page.getByRole('row').filter({ hasText: 'Allier' });
  await expect(allier).toHaveCount(1);
  expect(await rowCells(allier)).toEqual([
    '03 Allier',
    '1', // examinateurs actifs
    '3', // GG agréé
    '0', // GG non agréé
    '0', // GG domestique
    '3', // GG total
    '33.3%', // GG taux de saisie
    '10', // PG agréé (animaux)
    '0',
    '0',
    '10', // PG total (animaux)
  ]);

  const ardeche = page.getByRole('row').filter({ hasText: 'Ardèche' });
  await expect(ardeche).toHaveCount(1);
  expect(await rowCells(ardeche)).toEqual([
    '07 Ardèche',
    '1',
    '3',
    '0',
    '0',
    '3',
    '0%',
    '10',
    '0',
    '0',
    '10',
  ]);

  // Ligne Total : un taux ne se somme pas, il vaut « — ».
  const total = page.getByRole('table').locator('tfoot').getByRole('row');
  expect(await rowCells(total)).toEqual(['Total', '2', '6', '0', '0', '6', '—', '20', '0', '0', '20']);
});

test("FDC — chiffres limités à son département, fiche admin de l'Allier exclue", async ({ page }) => {
  await openTableauDeBordFederation(page, 'fdc@example.fr');

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord FDC Allier (03)' })).toBeVisible({
    timeout: 15000,
  });

  // L'Allier porte deux fiches de forme identique : celle de Marie Martin et celle du compte
  // admin. Sans l'exclusion on verrait 6 carcasses GG, 20 animaux de petit gibier,
  // 2 examinateurs actifs et 4 anomalies.
  const prelevees = section(page, 'Carcasses prélevées');
  await expect(kpi(prelevees, 'Grand gibier')).toHaveText('3');
  await expect(kpi(prelevees, 'Petit gibier')).toHaveText('10');

  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpi(sanitaire, 'Examinateurs actifs')).toHaveText('1');
  await expect(kpiFromSublabel(sanitaire, "Anomalies signalées lors de l'examen initial")).toHaveText('2');
  await expect(kpi(sanitaire, /^Taux de saisie saison \d{2}-\d{2}$/)).toHaveText('33.3%');

  // Périmètre départemental : pas de détail par département.
  await expect(page.getByRole('heading', { level: 2, name: 'Détail par département' })).toHaveCount(0);
});

test('FRC — chiffres limités aux départements de sa région', async ({ page }) => {
  await openTableauDeBordFederation(page, 'frc@example.fr');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Tableau de bord FRC Auvergne-Rhône-Alpes' })
  ).toBeVisible({ timeout: 15000 });

  // Auvergne-Rhône-Alpes couvre l'Allier et l'Ardèche : mêmes chiffres qu'au national,
  // fiche admin toujours exclue. Tous les départements de la région ont une ligne, même sans carcasse.
  const prelevees = section(page, 'Carcasses prélevées');
  await expect(kpi(prelevees, 'Grand gibier')).toHaveText('6');
  await expect(kpi(prelevees, 'Petit gibier')).toHaveText('20');

  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpi(sanitaire, 'Examinateurs actifs')).toHaveText('2');
  await expect(kpi(sanitaire, /^Taux de saisie saison \d{2}-\d{2}$/)).toHaveText('16.7%');

  // Périmètre régional : le détail par département est affiché, sans le filtre.
  await expect(page.getByRole('heading', { level: 2, name: 'Détail par département' })).toBeVisible();
  await expect(page.getByPlaceholder('Filtrer par département')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Ardèche' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Allier' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: '69 Rhône' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Paris' })).toHaveCount(0);
});
