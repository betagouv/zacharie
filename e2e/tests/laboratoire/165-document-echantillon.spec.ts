import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 165 — Le laboratoire joint un fichier à un échantillon d'un pool reçu.
// Seed LABORATOIRE_FTP_RECUE : laboratoire@example.fr (Laboratoire 1, LVD) a réceptionné la FTP
// F-26-SVI01-0001 du SVI 1. Le pool P-26-SVI01-0001 contient E-26-SVI01-0001 (MM-001-001) et
// E-26-SVI01-0002 (MM-001-002), sans résultat.
// Le stockage Cellar n'est pas configuré en test : le dépôt atteint la route (droits du laboratoire
// vérifiés) et le serveur répond que le stockage n'est pas disponible. Un échantillon retiré du pool
// n'accepte plus de fichier.

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('LABORATOIRE_FTP_RECUE');
});

test('Le laboratoire joint un fichier à un échantillon, pas à un échantillon retiré du pool', async ({
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

  await expect(echantillonGarde.getByRole('button', { name: 'Joindre un fichier' })).toBeVisible();
  await expect(echantillonRetire.getByRole('button', { name: 'Joindre un fichier' })).toBeVisible();

  await page.getByLabel("Joindre un fichier à l'échantillon E-26-SVI01-0001").setInputFiles({
    name: 'etiquette.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4', 'utf-8'),
  });
  await expect(page.getByText("Le stockage de documents n'est pas disponible")).toBeVisible({
    timeout: 10000,
  });

  // Un échantillon retiré du pool n'accepte plus de fichier
  await echantillonRetire.getByRole('button', { name: 'Retirer du pool' }).click();
  const modale = page.getByRole('dialog', { name: /Retirer l'échantillon E-26-SVI01-0002/ });
  await expect(modale).toBeVisible();
  await modale.getByLabel('Motif du retrait (obligatoire)').fill('Tube absent du colis');
  await modale.getByRole('button', { name: 'Confirmer le retrait' }).click();
  await expect(page.getByText('Échantillon retiré du pool, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });
  await expect(echantillonRetire.getByText(/motif : Tube absent du colis/)).toBeVisible();
  await expect(echantillonRetire.getByRole('button', { name: 'Joindre un fichier' })).toHaveCount(0);
  await expect(echantillonGarde.getByRole('button', { name: 'Joindre un fichier' })).toBeVisible();
});
