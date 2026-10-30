import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 161 — Le laboratoire donne sa référence à un échantillon et en retire un autre de son pool.
// Seed LABORATOIRE_FTP_RECUE : laboratoire@example.fr (Laboratoire 1, LVD) a réceptionné la FTP
// F-26-SVI01-0001 du SVI 1. Le pool P-26-SVI01-0001 contient E-26-SVI01-0001 (MM-001-001) et
// E-26-SVI01-0002 (MM-001-002), sans résultat.
// L'échantillon retiré sort du pool : il n'hérite pas du résultat, et le SVI le voit à re-prélever.

// L'espace laboratoire n'est monté que si l'app est construite avec VITE_FEATURE_TRICHINE=true
// (cf App.tsx). Pour lancer la spec : construire l'app et lancer Playwright avec cette variable.
test.skip(process.env.VITE_FEATURE_TRICHINE !== 'true', 'Feature trichine désactivée dans ce build');

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('LABORATOIRE_FTP_RECUE');
});

test('Le laboratoire référence un échantillon, en retire un autre, puis rend le résultat du pool', async ({
  page,
}) => {
  await connectWith(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto('/app/laboratoire/pools/P-26-SVI01-0001');
  await expect(page.getByRole('heading', { name: 'P-26-SVI01-0001' })).toBeVisible({ timeout: 10000 });
  await page.getByRole('button', { name: 'Afficher le détail' }).click();

  const echantillonGarde = page.getByRole('listitem').filter({ hasText: 'E-26-SVI01-0001' });
  const echantillonRetire = page.getByRole('listitem').filter({ hasText: 'E-26-SVI01-0002' });

  // Référence interne du laboratoire sur un échantillon
  await echantillonGarde.getByLabel('Ma référence').fill('LAB-42');
  await echantillonGarde.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Référence enregistrée')).toBeVisible({ timeout: 10000 });
  await expect(echantillonGarde.getByLabel('Ma référence')).toHaveValue('LAB-42');

  // Retrait de l'autre échantillon, motif obligatoire
  await echantillonRetire.getByRole('button', { name: 'Retirer du pool' }).click();
  const modale = page.getByRole('dialog', { name: /Retirer l'échantillon E-26-SVI01-0002/ });
  await expect(modale).toBeVisible();
  const confirmer = modale.getByRole('button', { name: 'Confirmer le retrait' });
  await expect(confirmer).toBeDisabled();
  await modale.getByLabel('Motif du retrait (obligatoire)').fill('Tube absent du colis');
  await confirmer.click();
  await expect(page.getByText('Échantillon retiré du pool, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });

  await expect(
    page.getByText('1 échantillon — carcasses MM-001-001 — 1 retiré par le laboratoire')
  ).toBeVisible();
  await expect(page.getByText('Retirés du pool par le laboratoire')).toBeVisible();
  await expect(echantillonRetire.getByText(/motif : Tube absent du colis/)).toBeVisible();
  // Le dernier échantillon ne se retire pas : c'est alors le pool qu'on refuse
  await expect(echantillonGarde.getByRole('button', { name: 'Retirer du pool' })).toHaveCount(0);

  // Résultat du pool : ne concerne plus que l'échantillon gardé
  await page.getByRole('button', { name: 'Saisir le résultat' }).click();
  await page.getByLabel("Résultat d'analyse").selectOption({ label: 'Négatif' });
  await page.getByRole('button', { name: 'Enregistrer le résultat' }).click();
  await expect(page.getByText('Résultat enregistré, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });

  // Côté SVI : l'échantillon retiré n'a pas de résultat, la carcasse est à re-prélever
  await logoutAndConnect(page, 'svi@example.fr');
  await page.goto('/app/svi/trichine/echantillons/E-26-SVI01-0002');
  await expect(page.getByRole('heading', { name: 'E-26-SVI01-0002' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Retiré par le laboratoire', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Tube absent du colis')).toBeVisible();
  await expect(page.getByText('Négatif', { exact: true })).toHaveCount(0);
  // Trace figée : plus rien n'est modifiable sur l'échantillon retiré
  await expect(page.getByRole('button', { name: 'Modifier' })).toHaveCount(0);

  await page.goto('/app/svi/trichine/echantillons/E-26-SVI01-0001');
  await expect(page.getByRole('heading', { name: 'E-26-SVI01-0001' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Négatif').first()).toBeVisible();
});
