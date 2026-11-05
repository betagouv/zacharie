import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

// Scenario 166 — Chemin critique trichine du circuit agréé, résultat négatif.
// Seed SVI_SANGLIERS : la fiche ZACH-20250707-QZ6E0-185242 est chez le SVI 1 (svi@example.fr) avec trois
// sangliers sans prélèvement (MM-001-001, MM-001-002, MM-001-004). laboratoire@example.fr travaille pour
// « Laboratoire 1 » (LVD, Moulins).
// Le SVI ne peut pas accepter un sanglier sans résultat négatif ; il prélève, regroupe en un pool, envoie
// la FTP au LVD ; le LVD réceptionne et rend un résultat négatif ; le SVI peut alors accepter.

test.setTimeout(180_000);
test.use({ launchOptions: { slowMo: 100 } });

const feiId = 'ZACH-20250707-QZ6E0-185242';
const sangliers = ['MM-001-001', 'MM-001-002', 'MM-001-004'];

test.beforeEach(async () => {
  await resetDb('SVI_SANGLIERS');
});

test('Le SVI prélève, envoie au LVD, le LVD rend un négatif, le SVI accepte le sanglier', async ({
  page,
}) => {
  await connectWith(page, 'svi@example.fr');
  await expect(page).toHaveURL(/\/app\/svi/);

  // 1. Sans résultat négatif, l'acceptation en un clic est refusée
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/svi/fei/${feiId}`));
  const carteSanglier = page.getByRole('button', { name: /Sanglier.*MM-001-001/ }).first();
  const accepter = carteSanglier.getByRole('button', { name: 'Accepter' });
  await accepter.scrollIntoViewIfNeeded();
  const alerteRefus = page.waitForEvent('dialog');
  await accepter.click();
  const dialog = await alerteRefus;
  expect(dialog.message()).toContain('Recherche trichine obligatoire avant acceptation');
  await dialog.dismiss();
  await expect(carteSanglier.getByText(/Décision IPM1\s*:\s*Acceptée/)).toHaveCount(0);

  // 2. Prélèvement des trois sangliers, regroupés automatiquement en un pool
  await page.goto('/app/svi/trichine/prelever');
  await expect(page.getByRole('heading', { name: 'Prélever pour la recherche de trichine' })).toBeVisible({
    timeout: 10000,
  });
  for (const bracelet of sangliers) {
    await page.getByRole('checkbox', { name: `Sélectionner ${bracelet}` }).check();
  }
  await expect(page.getByText('3 carcasses sélectionnées')).toBeVisible();
  await page.getByRole('button', { name: 'Continuer' }).click(); // → Prélèvement
  await page.getByRole('button', { name: 'Continuer' }).click(); // → Regroupement
  await page.getByRole('button', { name: 'Continuer' }).click(); // → Récapitulatif
  await expect(page.getByRole('heading', { name: 'Récapitulatif' })).toBeVisible();
  await page.getByRole('button', { name: 'Enregistrer le prélèvement' }).click();
  await expect(page.getByRole('heading', { name: 'Prélèvement enregistré' })).toBeVisible({ timeout: 10000 });

  // 3. FTP vers le LVD, puis envoi
  await page.getByRole('link', { name: 'Créer la fiche de transmission' }).click();
  await expect(
    page.getByRole('heading', { name: 'Nouvelle fiche de transmission des prélèvements (FTP)' })
  ).toBeVisible({ timeout: 10000 });
  await page
    .getByLabel('Laboratoire destinataire (LVD agréé)')
    .selectOption({ label: 'Laboratoire 1 — Moulins' });
  await page.getByRole('button', { name: 'Créer la FTP (1 pool)' }).click();
  await expect(page).toHaveURL(/\/app\/svi\/trichine\/ftp\/F-/, { timeout: 10000 });
  const numeroFtp = decodeURIComponent(page.url().split('/ftp/')[1]);

  await page.getByRole('button', { name: 'Envoyer au laboratoire' }).click();
  await expect(page.getByText(`FTP ${numeroFtp} envoyée au laboratoire`)).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Envoyer au laboratoire' })).toHaveCount(0);

  // 4. Le LVD réceptionne le colis et rend un résultat négatif
  await logoutAndConnect(page, 'laboratoire@example.fr');
  await expect(page).toHaveURL(/\/app\/laboratoire/);
  await page.goto(`/app/laboratoire/ftp/${numeroFtp}`);
  await page.getByRole('button', { name: 'Confirmer la réception' }).click();
  await expect(page.getByText('Réception confirmée, vous pouvez saisir les résultats')).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Saisir le résultat' }).click();
  await page.getByRole('dialog').getByText('Négatif', { exact: true }).click();
  await page.getByRole('button', { name: 'Enregistrer le résultat' }).click();
  await expect(page.getByText('Résultat enregistré, l’émetteur a été notifié')).toBeVisible({
    timeout: 10000,
  });

  // 5. Le SVI accepte désormais le sanglier, et la décision est enregistrée côté serveur
  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  const carteApresResultat = page.getByRole('button', { name: /Sanglier.*MM-001-001/ }).first();
  const accepterApresResultat = carteApresResultat.getByRole('button', { name: 'Accepter' });
  await accepterApresResultat.scrollIntoViewIfNeeded();
  const synchro = page.waitForResponse(
    (resp) => resp.url().includes('/sync') && resp.request().method() === 'POST' && resp.ok(),
    { timeout: 15000 }
  );
  await accepterApresResultat.click();
  await expect(carteApresResultat.getByText(/Décision IPM1\s*:\s*Acceptée/)).toBeVisible({ timeout: 10000 });
  await synchro;

  await logoutAndConnect(page, 'svi@example.fr');
  await expect(page.getByRole('link', { name: feiId })).toBeVisible({ timeout: 10000 });
  await page.getByRole('link', { name: feiId }).click();
  await expect(
    page
      .getByRole('button', { name: /Sanglier.*MM-001-001/ })
      .first()
      .getByText(/Décision IPM1\s*:\s*Acceptée/)
  ).toBeVisible({ timeout: 10000 });
});
