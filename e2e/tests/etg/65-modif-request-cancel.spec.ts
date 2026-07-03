import { test, expect } from '../../utils/test';
import { resetDb } from '../../scripts/reset-db';
import { connectWith } from '../../utils/connect-with';

test.beforeEach(async () => {
  await resetDb('ETG_TAKEN_CHARGE');
});

test.use({ launchOptions: { slowMo: 100 } });

// Scenario 65 — Requester cancels their own pending modification request.
// After cancellation the pending banner is gone, no warning icon on the card, and the rename
// button reappears (since one pending request blocks new ones).
test('Annulation : le demandeur peut annuler sa propre demande pendante', async ({ page }) => {
  const feiId = 'ZACH-20250707-QZ6E0-235242';

  await connectWith(page, 'etg-1@example.fr');
  await page.getByRole('link', { name: feiId }).click();

  const carcasseBtn = page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' });
  await carcasseBtn.scrollIntoViewIfNeeded();
  await carcasseBtn.click();

  await page.getByRole('button', { name: 'Signaler un numéro de marquage incorrect' }).click();
  await page.getByLabel('Numéro de marquage correct').fill('MM-001-FIX');
  await page.getByRole('button', { name: 'Envoyer la demande' }).click();

  // Pending banner attached under the card.
  const pendingBanner = page.getByText('Demande de modification du numéro de marquage en cours').first();
  await expect(pendingBanner).toBeVisible({ timeout: 10000 });

  // Confirm dialog → accept.
  await new Promise((resolve) => setTimeout(resolve, 1000)); // for sync
  // page.once('dialog', (dialog) => {
  //   setTimeout(() => {
  //     dialog.accept();
  //   }, 1000);
  // });
  await page.getByRole('button', { name: 'Annuler ma demande' }).click();

  // Banner gone.
  await expect(page.getByText('Demande de modification du numéro de marquage en cours')).toHaveCount(0, {
    timeout: 10000,
  });

  // The rename button is available again (one-pending-per-carcasse rule no longer applies).
  await page.getByRole('button', { name: 'Daim N° MM-001-001 Mise à' }).click();
  await expect(page.getByRole('button', { name: 'Signaler un numéro de marquage incorrect' })).toBeVisible();
});
