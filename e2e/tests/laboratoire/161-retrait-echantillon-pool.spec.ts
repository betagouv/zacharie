import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

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
  await expect(page.getByRole('heading', { level: 1, name: 'P-26-SVI01-0001' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Afficher le détail' }).click();

  const echantillonGarde = page.getByRole('listitem').filter({ hasText: 'E-26-SVI01-0001' });
  const echantillonRetire = page.getByRole('listitem').filter({ hasText: 'E-26-SVI01-0002' });

  await echantillonGarde.getByLabel('Ma référence').fill('LAB-42');
  await echantillonGarde.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Référence enregistrée')).toBeVisible({ timeout: 10000 });
  await expect(echantillonGarde.getByLabel('Ma référence')).toHaveValue('LAB-42');

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
  await expect(echantillonGarde.getByRole('button', { name: 'Retirer du pool' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Saisir le résultat' }).click();
  await page.getByRole('dialog').getByText('Négatif', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le résultat' }).click();
  await expect(page.getByText('Résultat enregistré, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });

  await logoutAndConnect(page, 'svi@example.fr');
  await page.goto('/app/svi/trichine/echantillons/E-26-SVI01-0002');
  await expect(page.getByRole('heading', { name: 'E-26-SVI01-0002' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Retiré par le laboratoire', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('Tube absent du colis')).toBeVisible();
  await expect(page.getByText('Négatif', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Modifier' })).toHaveCount(0);

  await page.goto('/app/svi/trichine/echantillons/E-26-SVI01-0001');
  await expect(page.getByRole('heading', { name: 'E-26-SVI01-0001' })).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Négatif').first()).toBeVisible();
});
