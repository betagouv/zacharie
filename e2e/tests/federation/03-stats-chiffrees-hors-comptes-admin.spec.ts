import { test, expect } from '../../utils/test';
import type { Locator, Page } from '@playwright/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('FEDERATION_STATS');
});

function section(page: Page, heading: string) {
  return page.locator('section').filter({ has: page.getByRole('heading', { level: 2, name: heading }) });
}

function kpi(root: Locator, label: string | RegExp) {
  const text = typeof label === 'string' ? root.getByText(label, { exact: true }) : root.getByText(label);
  return text.locator('xpath=following-sibling::div[1]');
}

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

  const activite = section(page, 'Activité de la saison');
  await expect(kpi(activite, 'Examinateurs actifs')).toHaveText('1');
  await expect(kpi(activite, 'Grand gibier')).toHaveText('6');
  await expect(kpi(activite, 'Petit gibier')).toHaveText('20');

  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpi(sanitaire, 'Examinateurs actifs')).toHaveCount(0);
  await expect(kpiFromSublabel(sanitaire, "Anomalies signalées lors de l'examen initial")).toHaveText('4');
  await expect(kpi(sanitaire, /^Taux de saisie national saison \d{2}-\d{2}$/)).toHaveText('16.7%');
  await expect(kpi(sanitaire, 'Taux de saisie national 25-26')).toHaveText('23.9%');

  await expect(page.getByPlaceholder('Filtrer par département')).toBeVisible();

  const allier = page.getByRole('row').filter({ hasText: 'Allier' });
  await expect(allier).toHaveCount(1);
  expect(await rowCells(allier)).toEqual([
    '03 Allier',
    '1',
    '3',
    '0',
    '0',
    '3',
    '33.3%',
    '10',
    '0',
    '0',
    '10',
    'Accéder au tableau de bord',
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
    'Accéder au tableau de bord',
  ]);

  const ain = page.getByRole('row').filter({ hasText: '01 Ain' });
  await expect(ain).toHaveCount(1);
  expect((await rowCells(ain))[1]).toBe('0');

  const total = page.getByRole('table').locator('tfoot').getByRole('row');
  expect(await rowCells(total)).toEqual(['Total', '—', '6', '0', '0', '6', '—', '20', '0', '0', '20', '']);

  await allier.getByRole('link', { name: 'Accéder au tableau de bord' }).click();
  await expect(page).toHaveURL(/\/app\/federation\/tableau-de-bord\/federation-fdc-03$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord FDC Allier (03)' })).toBeVisible({
    timeout: 15000,
  });
  await expect(kpi(section(page, 'Activité de la saison'), 'Grand gibier')).toHaveText('3');
  await page.getByRole('link', { name: 'Retour à mon tableau de bord' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord national' })).toBeVisible({
    timeout: 15000,
  });
});

test("FDC — chiffres limités à son département, fiche admin de l'Allier exclue", async ({ page }) => {
  await openTableauDeBordFederation(page, 'fdc@example.fr');

  await expect(page.getByRole('heading', { level: 1, name: 'Tableau de bord FDC Allier (03)' })).toBeVisible({
    timeout: 15000,
  });

  const activite = section(page, 'Activité de la saison');
  await expect(kpi(activite, 'Examinateurs actifs')).toHaveText('1');
  await expect(kpi(activite, 'Grand gibier')).toHaveText('3');
  await expect(kpi(activite, 'Petit gibier')).toHaveText('10');

  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpiFromSublabel(sanitaire, "Anomalies signalées lors de l'examen initial")).toHaveText('2');
  await expect(kpi(sanitaire, /^Taux de saisie départemental saison \d{2}-\d{2}$/)).toHaveText('33.3%');

  await expect(page.getByRole('heading', { level: 2, name: 'Détail par département' })).toHaveCount(0);
});

test('FRC — chiffres limités aux départements de sa région', async ({ page }) => {
  await openTableauDeBordFederation(page, 'frc@example.fr');

  await expect(
    page.getByRole('heading', { level: 1, name: 'Tableau de bord FRC Auvergne-Rhône-Alpes' })
  ).toBeVisible({ timeout: 15000 });

  const activite = section(page, 'Activité de la saison');
  await expect(kpi(activite, 'Examinateurs actifs')).toHaveText('1');
  await expect(kpi(activite, 'Grand gibier')).toHaveText('6');
  await expect(kpi(activite, 'Petit gibier')).toHaveText('20');

  const sanitaire = section(page, 'Suivi sanitaire grand gibier');
  await expect(kpi(sanitaire, /^Taux de saisie régional saison \d{2}-\d{2}$/)).toHaveText('16.7%');

  const ain = page.getByRole('row').filter({ hasText: '01 Ain' });
  await expect(ain).toHaveCount(1);
  expect((await rowCells(ain))[1]).toBe('0');

  await expect(page.getByRole('heading', { level: 2, name: 'Détail par département' })).toBeVisible();
  await expect(page.getByPlaceholder('Filtrer par département')).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Ardèche' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Allier' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: '69 Rhône' })).toHaveCount(1);
  await expect(page.getByRole('row').filter({ hasText: 'Paris' })).toHaveCount(0);
});
