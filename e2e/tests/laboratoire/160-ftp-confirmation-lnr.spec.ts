import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

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

  const carte = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: 'P-26-SVI01-0002' }) })
    .filter({ has: page.getByRole('button', { name: 'Saisir le résultat' }) })
    .last();
  await carte.getByRole('button', { name: 'Saisir le résultat' }).scrollIntoViewIfNeeded();
  await carte.getByRole('button', { name: 'Saisir le résultat' }).click();

  const modale = page.getByRole('dialog', { name: 'Résultat du pool P-26-SVI01-0002' });
  await modale.getByText('Non négatif — à confirmer par le LNR', { exact: true }).click();

  const transmettre = modale.getByRole('button', { name: 'Enregistrer et transmettre au LNR' });
  await expect(transmettre).toBeDisabled();
  await modale.getByLabel('Nombre de larves découvertes dans le pool').fill('3');
  await expect(transmettre).toBeDisabled();

  await modale.getByLabel("Date d'envoi des échantillons").fill('2026-10-28');
  await modale.getByLabel("Date d'envoi des échantillons").blur();
  await modale.getByLabel('Modalités de transmission (optionnel)').fill('Chronopost, colis isotherme');
  await modale
    .getByLabel("Conditions de conservation de l'élément parasitaire")
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

  await logoutAndConnect(page, 'lnr@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto(urlFicheConfirmation);
  await expect(page.getByText('28/10/2026').first()).toBeVisible({ timeout: 10000 });
  await expect(page.getByText('Chronopost, colis isotherme')).toBeVisible();
  await expect(page.getByText('Larves dans l’éthanol à 70 %, sous froid positif')).toBeVisible();
  await expect(page.getByText('Larves comptées par le laboratoire agréé : 3')).toBeVisible();
});

test('Le LVD enregistre une analyse impossible depuis la modale de résultat, dates d’analyse contrôlées', async ({
  page,
}) => {
  await connectWith(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto('/app/laboratoire/ftp/F-26-SVI01-0001');

  const carte = page
    .locator('div')
    .filter({ has: page.getByRole('link', { name: 'P-26-SVI01-0001' }) })
    .filter({ has: page.getByRole('button', { name: 'Saisir le résultat' }) })
    .last();
  await expect(carte.getByRole('button', { name: 'Refuser ce pool' })).toHaveCount(0);
  await carte.getByRole('button', { name: 'Saisir le résultat' }).scrollIntoViewIfNeeded();
  await carte.getByRole('button', { name: 'Saisir le résultat' }).click();

  const modale = page.getByRole('dialog', { name: 'Résultat du pool P-26-SVI01-0001' });
  const enregistrer = modale.getByRole('button', { name: 'Enregistrer le résultat' });

  await modale.getByText('Négatif', { exact: true }).click();
  await modale.getByLabel("Début d'analyse (optionnel)").fill('2026-07-03');
  await modale.getByLabel("Début d'analyse (optionnel)").blur();
  await modale.getByLabel("Fin d'analyse (optionnel)").fill('2026-07-02');
  await modale.getByLabel("Fin d'analyse (optionnel)").blur();
  await expect(modale.getByText('La fin doit suivre le début d’analyse')).toBeVisible();
  await expect(enregistrer).toBeDisabled();

  await modale.getByText(/^Analyse impossible/).click();
  await expect(modale.getByLabel("Fin d'analyse (optionnel)")).toHaveCount(0);
  await expect(enregistrer).toBeDisabled();
  await modale.getByLabel('Raison de l’analyse impossible').fill('Échantillon putréfié');
  await enregistrer.scrollIntoViewIfNeeded();
  await enregistrer.click();

  await expect(page.getByText('Analyse impossible enregistrée, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByText('Raison du refus : Échantillon putréfié')).toBeVisible({ timeout: 10000 });
});
