import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeAll(async () => {
  await resetDb('FNC');
});

test('FNC — tableau de bord national affiche toutes les sections', async ({ page }) => {
  await connectWith(page, 'fnc@example.fr');
  // fnc@ n'est pas chasseur (rôle FEDERATION) : il arrive directement sur le tableau de bord
  await expect(page).toHaveURL(/\/app\/federation\/tableau-de-bord/);

  // Title
  await expect(page.getByRole('heading', { name: 'Tableau de bord national' })).toBeVisible({
    timeout: 15000,
  });

  // Season badge
  await expect(page.getByText(/Saison \d{2}-\d{2}/)).toBeVisible();

  // Info banner
  await expect(page.getByText('Statistiques anonymes agrégées par département')).toBeVisible();

  // Section: Carcasses prélevées
  await expect(page.getByRole('heading', { name: 'Carcasses prélevées' })).toBeVisible();
  await expect(page.getByText('Grand gibier').first()).toBeVisible();
  await expect(page.getByText('Petit gibier').first()).toBeVisible();

  // Section: Circuits de valorisation
  await expect(page.getByRole('heading', { name: 'Circuits de valorisation' })).toBeVisible();
  await expect(page.getByText('Circuits grand gibier')).toBeVisible();
  await expect(page.getByText('Circuits petit gibier')).toBeVisible();

  // Section: Suivi sanitaire grand gibier
  await expect(page.getByRole('heading', { name: 'Suivi sanitaire grand gibier' })).toBeVisible();
  await expect(page.getByText('Examens initiaux chasseurs')).toBeVisible();
  await expect(page.getByText('Examinateurs actifs').first()).toBeVisible();
  await expect(page.getByText('Anomalies signalées').first()).toBeVisible();
  await expect(page.getByText('Inspections services vétérinaires')).toBeVisible();

  // Section: Détail par département (visible for national scope)
  await expect(page.getByRole('heading', { name: 'Détail par département' })).toBeVisible();
  await expect(page.getByPlaceholder('Filtrer par département')).toBeVisible();
});
