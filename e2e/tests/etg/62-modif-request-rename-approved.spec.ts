import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';
import { logoutAndConnect } from '../../utils/logout-and-connect';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 62 — Modification request RENAME, full multi-actor round-trip.
// ETG signals a wrong marquage → examinateur approves → ETG sees the updated marquage on the card,
// the pending banner is gone, and the history timeline shows the request + approval dots.
test('Rename marquage : ETG signale → examinateur approuve → maj visible côté ETG', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  // ----- Step 1: ETG opens the carcasse modal and signals an incorrect marquage ------------------
  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  await expect(page).toHaveURL(new RegExp(`/app/etg/fei/${feiId}`));

  // Open the carcasse modal (the refus modal is reused for all carcasse actions including rename).
  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  // Inline-expand the rename form via the "Signaler un numéro de marquage incorrect" button.
  const signalBtn = page.getByRole('button', { name: 'Signaler un numéro de marquage incorrect' });
  await signalBtn.scrollIntoViewIfNeeded();
  await signalBtn.click();

  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByLabel('Commentaire (optionnel)').fill('Le 1 et le F ont été confondus');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  // The outer refus modal closes after submission. The PendingModificationBanner shows up under the
  // card to confirm sync round-trip.
  await expect(page.getByText('Demande de modification du numéro de marquage en cours').first()).toBeVisible({
    timeout: 10000,
  });

  // ----- Step 2: Switch to examinateur and approve -----------------------------------------------
  await logoutAndConnect(page, 'examinateur@example.fr');
  // The dashboard alert modal pops automatically on /app/chasseur.
  await expect(page.getByRole('heading', { name: 'Demandes de modification en attente' })).toBeVisible({
    timeout: 10000,
  });
  await page.getByRole('button', { name: 'Voir les demandes' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);

  await page.getByRole('link', { name: 'Voir et traiter' }).first().click();
  await expect(page.getByRole('heading', { name: 'Changement de numéro de marquage' })).toBeVisible();
  await expect(page.getByText('MM-001-001')).toBeVisible();
  await expect(page.getByText('MM-001-FIX')).toBeVisible();

  await page.getByRole('button', { name: 'Approuver le changement' }).click();
  await expect(page).toHaveURL(/\/app\/chasseur\/demandes-de-modification$/);
  // The list is now empty for this user.
  await expect(page.getByText(/Aucune demande en attente/)).toBeVisible({ timeout: 10000 });

  // ----- Step 3: Back to ETG — verify the marquage has been updated ------------------------------
  await logoutAndConnect(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();
  // New marquage shows on the card. Old marquage button is gone.
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-FIX Mise à' })).toBeVisible({
    timeout: 10000,
  });
  await expect(page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' })).toHaveCount(0);
  // The pending banner is gone, the card description gained a "1 modification" line.
  await expect(page.getByText('Demande de modification du numéro de marquage en cours')).toHaveCount(0);
  await expect(page.getByText('1 modification').first()).toBeVisible();
});
