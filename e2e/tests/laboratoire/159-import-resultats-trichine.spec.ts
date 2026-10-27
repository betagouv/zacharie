import { test, expect, type Page } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

// Scenario 159 — Import de résultats trichine par fichier CSV (laboratoire).
// Seed LABORATOIRE_FTP_RECUE : laboratoire@example.fr (Laboratoire 1, LVD) a réceptionné la FTP
// F-26-SVI01-0001 avec deux pools sans résultat : P-26-SVI01-0001 (2 carcasses) et P-26-SVI01-0002
// (1 carcasse). L'aperçu montre ce que l'import va faire, le laboratoire choisit les lignes, puis importe.

// L'espace laboratoire n'est monté que si l'app est construite avec VITE_FEATURE_TRICHINE=true
// (cf App.tsx). Pour lancer la spec : construire l'app et lancer Playwright avec cette variable.
test.skip(process.env.VITE_FEATURE_TRICHINE !== 'true', 'Feature trichine désactivée dans ce build');

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('LABORATOIRE_FTP_RECUE');
});

const API_BASE = 'http://localhost:3291';

const csvValide = [
  'reference_pool;resultat_analyse;date_fin_analyse;reference_labo;colonne_du_lims',
  'P-26-SVI01-0001;Négatif;2026-10-21;LAB-001;ignorée',
  'P-26-SVI01-0002;negatif;2026-10-21;;ignorée',
  'P-26-XXXX-9999;negatif;;;',
].join('\n');

async function deposerFichier(page: Page, contenu: string) {
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: 'resultats.csv', mimeType: 'text/csv', buffer: Buffer.from(contenu, 'utf-8') });
}

async function ouvrirImport(page: Page) {
  await connectWith(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page
    .getByRole('navigation', { name: 'Navigation laboratoire' })
    .getByRole('link', { name: 'Importer', exact: true })
    .click();
  await expect(page.getByRole('heading', { name: "Importer des résultats d'analyse" })).toBeVisible();
}

async function statutLogistiqueFtp(page: Page, numeroFiche: string) {
  const cookies = await page.context().cookies();
  const jwt = cookies.find((c) => c.name === 'zacharie_express_jwt');
  const res = await page.request.get(`${API_BASE}/laboratoire/ftp`, {
    headers: { Cookie: `zacharie_express_jwt=${jwt!.value}` },
  });
  expect(res.status()).toBe(200);
  const body = await res.json();
  return body.data.ftps.find((ftp: { numero_fiche: string }) => ftp.numero_fiche === numeroFiche)
    ?.statut_logistique;
}

test("L'aperçu récapitule les actions, le laboratoire choisit les lignes puis importe", async ({ page }) => {
  await ouvrirImport(page);
  await deposerFichier(page, csvValide);

  // Statut de chaque ligne
  const ligne1 = page.getByRole('row').filter({ hasText: 'P-26-SVI01-0001' });
  const ligne2 = page.getByRole('row').filter({ hasText: 'P-26-SVI01-0002' });
  await expect(ligne1.getByText('À importer')).toBeVisible({ timeout: 10000 });
  await expect(ligne2.getByText('À importer')).toBeVisible();
  await expect(
    page.getByRole('row').filter({ hasText: 'P-26-XXXX-9999' }).getByText('Introuvable')
  ).toBeVisible();

  // Actions décrites ligne par ligne
  await expect(
    ligne1.getByText('Pool P-26-SVI01-0001 négatif : 2 carcasses libérée(s) côté trichine')
  ).toBeVisible();
  await expect(
    ligne1.getByText('Votre référence interne « LAB-001 » est enregistrée sur le pool')
  ).toBeVisible();
  await expect(
    ligne2.getByText('Pool P-26-SVI01-0002 négatif : 1 carcasse libérée(s) côté trichine')
  ).toBeVisible();

  // Récapitulatif des deux lignes cochées : la fiche se clôture
  await expect(
    page.getByRole('heading', { name: 'Si vous importez les 2 ligne(s) cochée(s)' })
  ).toBeVisible();
  await expect(page.getByText('3 carcasse(s) libérée(s)')).toBeVisible();
  await expect(page.getByText('Fiche(s) clôturée(s) : F-26-SVI01-0001')).toBeVisible();

  // Décocher une ligne : le récapitulatif suit, la fiche ne se clôture plus
  // CSS : la case DSFR n'a pas de libellé accessible (colonne « Import »)
  await ligne2.locator('input[type="checkbox"]').uncheck({ force: true });
  await expect(
    page.getByRole('heading', { name: 'Si vous importez les 1 ligne(s) cochée(s)' })
  ).toBeVisible();
  await expect(page.getByText('2 carcasse(s) libérée(s)')).toBeVisible();
  await expect(page.getByText('Fiche(s) clôturée(s)')).toHaveCount(0);

  await ligne2.locator('input[type="checkbox"]').check({ force: true });
  const importer = page.getByRole('button', { name: 'Importer 2 résultat(s)' });
  await importer.scrollIntoViewIfNeeded();
  await importer.click();

  await expect(page.getByText('Import terminé')).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('2 appliqué(s), 0 ignoré(s), 0 en erreur.')).toBeVisible();
  expect(await statutLogistiqueFtp(page, 'F-26-SVI01-0001')).toBe('TRAITEE');
});

test('Un fichier sans colonne obligatoire est refusé avec la liste des colonnes attendues', async ({
  page,
}) => {
  await ouvrirImport(page);
  await deposerFichier(page, 'reference_pool;resultat\nP-26-SVI01-0001;negatif');
  await expect(page.getByText(/Colonne\(s\) obligatoire\(s\) absente\(s\) : resultat_analyse/)).toBeVisible({
    timeout: 10000,
  });
});

test('La page de format décrit le fichier attendu', async ({ page }) => {
  await ouvrirImport(page);
  await page.getByRole('link', { name: 'Format du fichier à respecter' }).click();
  await expect(page.getByRole('heading', { name: "Format du fichier d'import de résultats" })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'presence_parasite_non_identifie' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Télécharger le modèle (CSV)' })).toHaveAttribute(
    'href',
    '/modele-import-resultats-trichine.csv'
  );
});
