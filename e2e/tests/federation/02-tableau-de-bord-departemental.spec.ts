import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('FDC');
});

test('FDC — tableau de bord départemental affiche les sections sans le détail par département', async ({
  page,
}) => {
  await connectWith(page, 'fdc@example.fr');
  await expect(page).toHaveURL(/\/app\/chasseur/);
  await page.getByRole('link', { name: 'Tableau de bord Fédération' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/tableau-de-bord-federation/);

  await expect(page.getByRole('heading', { name: 'Tableau de bord FDC Allier (03)' })).toBeVisible({
    timeout: 15000,
  });

  await expect(page.getByText(/Saison \d{2}-\d{2}/)).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Activité de la saison' })).toBeVisible();
  await expect(page.getByText('Examinateurs actifs').first()).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Circuits de valorisation' })).toBeVisible();
  await expect(page.getByText('Circuits grand gibier')).toBeVisible();
  await expect(page.getByText('Circuits petit gibier')).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Suivi sanitaire grand gibier' })).toBeVisible();

  await expect(page.getByRole('heading', { name: 'Détail par département' })).toHaveCount(0);
});
