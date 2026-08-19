import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 62 — Modification request RENAME, full multi-actor round-trip.
// ETG corrige un marquage → le numéro change TOUT DE SUITE → l'examinateur confirme → la bannière
// disparaît et la timeline montre la correction + la confirmation.
test('Rename marquage : ETG corrige → maj immédiate → examinateur confirme', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  // ----- Step 1: ETG opens the carcasse modal and signals an incorrect marquage ------------------
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  // Open the carcasse modal (the refus modal is reused for all carcasse actions including rename).
  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  // Inline-expand the rename form via the "Corriger le numéro de marquage" button.
  const signalBtn = page.getByRole('button', { name: 'Corriger le numéro de marquage' });
  await signalBtn.scrollIntoViewIfNeeded();
  await signalBtn.click();

  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByLabel('Commentaire (optionnel)').fill('Le 1 et le F ont été confondus');
  await page.getByRole('button', { name: 'Corriger le numéro' }).click();

  // The outer refus modal closes after submission. The PendingModificationBanner shows up under the
  // card to confirm sync round-trip — et le numéro est DÉJÀ corrigé, sans l'examinateur.
  await expect(page.getByText('Numéro de marquage corrigé').first()).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);

  // ----- Step 2: Switch to examinateur and confirm -----------------------------------------------
  await logoutAndConnect(page, 'examinateur@example.fr');
  // The dashboard alert modal pops automatically on /app/chasseur.
  await expect(page.getByRole('heading', { name: 'Modifications signalées sur vos carcasses' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  await page.getByRole('link', { name: 'Voir la demande' }).first().click();
  await expect(page.getByRole('heading', { name: 'Numéro de marquage corrigé' })).toBeVisible();
  // `exact` : la page affiche aussi l'historique, dont le libellé contient les deux numéros.
  await expect(page.getByText('MM-001-001', { exact: true })).toBeVisible();
  await expect(page.getByText('MM-001-FIX', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Confirmer le numéro' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);
  // The list is now empty for this user.
  await expect(page.getByText(/Aucune demande en cours/)).toBeVisible({ timeout: 10000 });

  // ----- Step 3: Back to ETG — le marquage corrigé a été persisté côté serveur -------------------
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);
  // The pending banner is gone, the card description gained a "1 modification" line.
  await expect(page.getByText('Numéro de marquage corrigé')).toHaveCount(0);
  await expect(page.getByText('1 modification').first()).toBeVisible();

  // La timeline garde la trace de la confirmation.
  await page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' }).click();
  await expect(page.getByText(/Numéro de marquage confirmé : MM-001-FIX/).first()).toBeVisible();
});
