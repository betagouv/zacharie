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

  // Title uses the federation name, not "départemental"
  await expect(page.getByRole('heading', { name: 'Tableau de bord FDC Allier (03)' })).toBeVisible({
    timeout: 15000,
  });

  // Season badge
  await expect(page.getByText(/Saison \d{2}-\d{2}/)).toBeVisible();

  // Section: Carcasses prélevées
  await expect(page.getByRole('heading', { name: 'Carcasses prélevées' })).toBeVisible();

  // Section: Circuits de valorisation — pie charts, not the old table card
  await expect(page.getByRole('heading', { name: 'Circuits de valorisation' })).toBeVisible();
  await expect(page.getByText('Circuits grand gibier')).toBeVisible();
  await expect(page.getByText('Circuits petit gibier')).toBeVisible();

  // Section: Suivi sanitaire grand gibier
  await expect(page.getByRole('heading', { name: 'Suivi sanitaire grand gibier' })).toBeVisible();

  // Section: Détail par département is NOT visible for departmental scope
  await expect(page.getByRole('heading', { name: 'Détail par département' })).toHaveCount(0);
});
