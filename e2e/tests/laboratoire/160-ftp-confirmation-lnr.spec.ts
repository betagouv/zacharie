import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 160 — FTP de confirmation LVD → LNR.
// Seed LABORATOIRE_FTP_RECUE : laboratoire@example.fr (Laboratoire 1, LVD) a réceptionné la FTP
// F-26-SVI01-0001 ; lnr@example.fr travaille pour le LNR. Sur un non négatif, le LVD indique le
// nombre de larves, la date d'envoi, les modalités de transmission et les conditions de conservation :
// la fiche de confirmation part d'office au LNR avec ces informations.

// L'espace laboratoire n'est monté que si l'app est construite avec VITE_FEATURE_TRICHINE=true
test.skip(process.env.VITE_FEATURE_TRICHINE !== 'true', 'Feature trichine désactivée dans ce build');

test.setTimeout(120_000);
test.use({ launchOptions: { slowMo: 100 } });

test.beforeEach(async () => {
  await resetDb('LABORATOIRE_FTP_RECUE');
});

test('Le LVD renseigne l’envoi au LNR avec le résultat non négatif, le LNR le lit sur la fiche', async ({
  page,
}) => {
  await connectWith(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto('/app/laboratoire/ftp/F-26-SVI01-0001');

  // Plus petit bloc qui porte à la fois la référence du pool et son bouton de saisie : la carte du pool
  const carte = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: 'P-26-SVI01-0002' }) })
    .filter({ has: page.getByRole('button', { name: 'Saisir le résultat' }) })
    .last();
  await carte.getByRole('button', { name: 'Saisir le résultat' }).scrollIntoViewIfNeeded();
  await carte.getByRole('button', { name: 'Saisir le résultat' }).click();

  const modale = page.getByRole('dialog', { name: 'Résultat du pool P-26-SVI01-0002' });
  await modale
    .getByLabel("Résultat d'analyse")
    .selectOption({ label: 'Non négatif — à confirmer par le LNR' });

  const transmettre = modale.getByRole('button', { name: 'Enregistrer et transmettre au LNR' });
  // Nombre de larves et conditions de conservation sont obligatoires
  await expect(transmettre).toBeDisabled();
  await modale.getByLabel('Nombre de larves découvertes dans le pool (obligatoire)').fill('3');
  await expect(transmettre).toBeDisabled();

  await modale.getByLabel("Date d'envoi des échantillons").fill('2026-10-28');
  await modale.getByLabel("Date d'envoi des échantillons").blur();
  await modale.getByLabel('Modalités de transmission (optionnel)').fill('Chronopost, colis isotherme');
  await modale
    .getByLabel("Conditions de conservation de l'élément parasitaire (obligatoire)")
    .fill('Larves dans l’éthanol à 70 %, sous froid positif');
  await transmettre.scrollIntoViewIfNeeded();
  await transmettre.click();

  await expect(page.getByText('Résultat non négatif enregistré')).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: 'Voir la fiche' }).click();
  await expect(page).toHaveURL(/\/app\/laboratoire\/ftp\/F-\d{2}-LV01-\d+/);
  const urlFicheConfirmation = new URL(page.url()).pathname;

  await expect(page.getByText('28/10/2026').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Chronopost, colis isotherme')).toBeVisible();
  await expect(page.getByText('Larves dans l’éthanol à 70 %, sous froid positif')).toBeVisible();

  // Le LNR reçoit la fiche avec les mêmes informations
  await logoutAndConnect(page, 'lnr@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto(urlFicheConfirmation);
  await expect(page.getByText('28/10/2026').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Chronopost, colis isotherme')).toBeVisible();
  await expect(page.getByText('Larves dans l’éthanol à 70 %, sous froid positif')).toBeVisible();
  await expect(page.getByText('Larves comptées par le laboratoire agréé : 3')).toBeVisible();
});
