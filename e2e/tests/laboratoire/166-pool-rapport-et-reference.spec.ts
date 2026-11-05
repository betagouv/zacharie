import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 166 — Page d'un pool côté laboratoire : le rapport d'analyse se joint par un bouton (pas de
// zone de dépôt affichée d'office) et la référence interne du laboratoire passe avant celle de Zacharie.
// Seed LABORATOIRE_FTP_RECUE : laboratoire@example.fr (Laboratoire 1, LVD) a réceptionné la FTP
// F-26-SVI01-0001 du SVI 1. Le pool P-26-SVI01-0001 est sans résultat et sans référence interne.
// Le stockage Cellar n'est pas configuré en test : le dépôt atteint la route et le serveur répond que
// le stockage n'est pas disponible.

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('LABORATOIRE_FTP_RECUE');
});

test('Le laboratoire joint le rapport par un bouton et retrouve le pool sous sa propre référence', async ({
  page,
}) => {
  await connectWith(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto('/app/laboratoire/pools/P-26-SVI01-0001');
  await expect(page.getByRole('heading', { level: 1, name: 'P-26-SVI01-0001' })).toBeVisible({
    timeout: 10000,
  });

  // Une seule action principale, le rapport se joint à la demande
  await expect(page.getByRole('button', { name: 'Saisir le résultat' })).toBeVisible();
  await expect(page.getByText(/Glissez-déposez/)).toHaveCount(0);
  await expect(page.getByRole('button', { name: "Joindre le rapport d'analyse" })).toBeVisible();
  await page.getByLabel("Joindre le rapport d'analyse du pool P-26-SVI01-0001").setInputFiles({
    name: 'rapport.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.4', 'utf-8'),
  });
  await expect(page.getByText("Le stockage de documents n'est pas disponible")).toBeVisible({
    timeout: 10000,
  });

  // La référence du laboratoire devient le titre, celle de Zacharie passe en sous-titre
  await page.getByLabel('Ma référence').fill('LAB-2026-001');
  await page.getByRole('button', { name: 'Enregistrer' }).click();
  await expect(page.getByText('Référence enregistrée')).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('heading', { level: 1, name: 'LAB-2026-001' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Pool reçu au laboratoire · Réf. Zacharie P-26-SVI01-0001')).toBeVisible();

  // Même ordre dans la liste des pools
  await page.goto('/app/laboratoire/pools');
  const ligne = page.getByRole('row').filter({ hasText: 'LAB-2026-001' });
  await expect(ligne).toBeVisible({ timeout: 10000 });
  await expect(ligne.getByText('P-26-SVI01-0001')).toBeVisible();
});
