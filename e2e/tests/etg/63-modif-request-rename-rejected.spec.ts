import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 63 — L'examinateur CONTESTE une correction de marquage.
// Le numéro NE revient PAS à l'ancien : c'est l'intermédiaire qui a la carcasse sous les yeux.
// Le désaccord est enregistré dans l'historique et signalé sur la carte.
test('Rename contesté : le numéro corrigé reste, le désaccord est tracé', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  await page.getByRole('button', { name: 'Corriger le numéro de marquage' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-Z99');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({
    timeout: 10000,
  });

  // Examinateur conteste.
  await logoutAndConnect(page, 'examinateur@example.fr');
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await page.getByRole('link', { name: 'Voir la demande' }).first().click();

  await page.getByLabel('Motif (optionnel)').fill("Non, c'est bien 002");
  await page.getByRole('button', { name: 'Contester' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  // ETG side: le numéro corrigé est CONSERVÉ (le refus ne rétablit pas l'ancien).
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  await expect(page.getByRole('button', { name: 'Daim N° MM-001-Z99 Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-002 Mise à' })).toHaveCount(0);
  // La bannière « en cours » a disparu, la carte affiche le compteur de modifications.
  await expect(page.getByText('Numéro de marquage corrigé')).toHaveCount(0);
  await expect(page.getByText('1 modification').first()).toBeVisible();

  // Open the modal — la timeline trace la contestation et son motif.
  await page.getByRole('button', { name: 'Daim N° MM-001-Z99 Mise à' }).click();
  await expect(page.getByText(/Numéro de marquage contesté/).first()).toBeVisible();
  await expect(page.getByText(/Motif.*Non, c'est bien 002/).first()).toBeVisible();
});
